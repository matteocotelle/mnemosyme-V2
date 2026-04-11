import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Room, Player } from '../interfaces/game.interfaces';
import {
  DEFAULT_GAME_SETTINGS,
  MAX_PLAYERS_PER_ROOM,
  MAX_CONCURRENT_ROOMS,
  ROOM_INACTIVITY_TIMEOUT_MS,
  ROOM_CLEANUP_INTERVAL_MS,
  GameSettings,
  ALLOWED_QUESTION_COUNTS,
  ALLOWED_TIMER_SECONDS,
} from '../game.constants';

@Injectable()
export class RoomService implements OnModuleInit, OnModuleDestroy {
  private rooms = new Map<string, Room>();
  private cleanupInterval: NodeJS.Timeout;

  onModuleInit() {
    this.cleanupInterval = setInterval(
      () => this.cleanupStaleRooms(),
      ROOM_CLEANUP_INTERVAL_MS,
    );
  }

  onModuleDestroy() {
    clearInterval(this.cleanupInterval);
  }

  // --- Room CRUD ---

  createRoom(socketId: string, pseudo: string, avatar?: string): Room | null {
    if (this.rooms.size >= MAX_CONCURRENT_ROOMS) return null;

    const roomId = uuidv4().split('-')[0];
    const room: Room = {
      id: roomId,
      creatorSocketId: socketId,
      players: [],
      phase: 'lobby',
      settings: { ...DEFAULT_GAME_SETTINGS },
      questions: [],
      previousQuestionIds: [],
      currentQuestionIndex: 0,
      answers: [],
      timer: { intervalRef: null, questionStartedAt: 0, durationMs: 0 },
      correctionQuestionIndex: 0,
      validatedAnswers: new Map(),
      opinionResults: new Map(),
      tripleQuestionIndices: [],
      lastActivityAt: Date.now(),
    };

    this.addPlayer(room, socketId, pseudo, avatar);
    this.rooms.set(roomId, room);
    return room;
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  getRoomCount(): number {
    return this.rooms.size;
  }

  deleteRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room?.timer.intervalRef) {
      clearInterval(room.timer.intervalRef);
    }
    this.rooms.delete(roomId);
  }

  touchRoom(room: Room): void {
    room.lastActivityAt = Date.now();
  }

  // --- Player management ---

  addPlayer(room: Room, socketId: string, name: string, avatar?: string): Player {
    const dedupedName = this.deduplicatePseudo(room, name, socketId);
    const existing = room.players.find(p => p.name === dedupedName);

    if (existing) {
      existing.socketId = socketId;
      if (avatar) existing.avatar = avatar;
      existing.isDisconnected = false;
      return existing;
    }

    const player: Player = {
      socketId,
      name: dedupedName,
      score: 0,
      avatar: avatar || '',
      isDisconnected: false,
      streak: { current: 0, max: 0 },
    };
    room.players.push(player);
    return player;
  }

  joinRoom(roomId: string, socketId: string, pseudo: string, avatar?: string): { room: Room; player: Player; isReconnection: boolean } | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    // Check if this is a reconnection (same name, was disconnected)
    const disconnectedPlayer = room.players.find(p => p.name === pseudo && p.isDisconnected);

    // If game already started and it's not a reconnection, block
    if (room.phase !== 'lobby' && !disconnectedPlayer) return null;

    // Check max players (only for new joins in lobby)
    if (!disconnectedPlayer && room.players.length >= MAX_PLAYERS_PER_ROOM) return null;

    const player = this.addPlayer(room, socketId, pseudo, avatar);
    this.touchRoom(room);

    return { room, player, isReconnection: !!disconnectedPlayer };
  }

  removePlayer(socketId: string): { roomId: string; room: Room } | null {
    for (const [roomId, room] of this.rooms.entries()) {
      const player = room.players.find(p => p.socketId === socketId);
      if (!player) continue;

      if (room.phase === 'lobby') {
        // In lobby: remove completely
        room.players = room.players.filter(p => p.socketId !== socketId);
        if (room.players.length === 0) {
          this.deleteRoom(roomId);
          return null;
        }
      } else {
        // In game/correction/result: mark as ghost
        player.isDisconnected = true;
      }

      // Creator succession
      if (room.creatorSocketId === socketId) {
        const nextCreator = room.players.find(p => !p.isDisconnected && p.socketId !== socketId);
        if (nextCreator) {
          room.creatorSocketId = nextCreator.socketId;
        } else if (room.players.length > 0) {
          room.creatorSocketId = room.players[0].socketId;
        } else {
          this.deleteRoom(roomId);
          return null;
        }
      }

      return { roomId, room };
    }
    return null;
  }

  isCreator(room: Room, socketId: string): boolean {
    return room.creatorSocketId === socketId;
  }

  // --- Game settings ---

  updateSettings(room: Room, partial: Partial<GameSettings>): void {
    if (partial.questionCount !== undefined) {
      if ((ALLOWED_QUESTION_COUNTS as readonly number[]).includes(partial.questionCount)) {
        room.settings.questionCount = partial.questionCount as GameSettings['questionCount'];
      }
    }
    if (partial.timerSeconds !== undefined) {
      if ((ALLOWED_TIMER_SECONDS as readonly number[]).includes(partial.timerSeconds)) {
        room.settings.timerSeconds = partial.timerSeconds as GameSettings['timerSeconds'];
      }
    }
    if (partial.noRepeat !== undefined) {
      room.settings.noRepeat = !!partial.noRepeat;
    }
    if (partial.categories !== undefined && Array.isArray(partial.categories)) {
      room.settings.categories = partial.categories.filter(c => typeof c === 'string');
    }
  }

  // --- Restart ---

  restartGame(room: Room): void {
    // Preserve previousQuestionIds for noRepeat
    if (room.settings.noRepeat) {
      room.previousQuestionIds = room.questions.map(q => q.id);
    } else {
      room.previousQuestionIds = [];
    }

    room.phase = 'lobby';
    room.currentQuestionIndex = 0;
    room.correctionQuestionIndex = 0;
    room.questions = [];
    room.answers = [];
    room.validatedAnswers = new Map();
    room.opinionResults = new Map();
    room.tripleQuestionIndices = [];
    if (room.timer.intervalRef) {
      clearInterval(room.timer.intervalRef);
    }
    room.timer = { intervalRef: null, questionStartedAt: 0, durationMs: 0 };
    room.players.forEach(p => {
      p.score = 0;
      p.streak = { current: 0, max: 0 };
    });
    // Remove disconnected players on restart
    room.players = room.players.filter(p => !p.isDisconnected);
    this.touchRoom(room);
  }

  // --- Private helpers ---

  private deduplicatePseudo(room: Room, requestedName: string, socketId: string): string {
    // If the player already exists with same name (reconnection), keep the name
    const existingWithName = room.players.find(p => p.name === requestedName);
    if (existingWithName && (existingWithName.isDisconnected || existingWithName.socketId === socketId)) {
      return requestedName;
    }
    if (!existingWithName) return requestedName;

    // Duplicate: add suffix
    const activeNames = room.players.filter(p => !p.isDisconnected).map(p => p.name);
    let suffix = 2;
    while (activeNames.includes(`${requestedName} (${suffix})`)) {
      suffix++;
    }
    return `${requestedName} (${suffix})`;
  }

  private cleanupStaleRooms(): void {
    const now = Date.now();
    for (const [roomId, room] of this.rooms.entries()) {
      const allDisconnected = room.players.length > 0 && room.players.every(p => p.isDisconnected);
      const isStale = now - room.lastActivityAt > ROOM_INACTIVITY_TIMEOUT_MS;

      if (room.players.length === 0 || allDisconnected || isStale) {
        console.log(`🧹 Cleanup room ${roomId} (stale=${isStale}, empty=${room.players.length === 0}, allDisco=${allDisconnected})`);
        this.deleteRoom(roomId);
      }
    }
  }
}
