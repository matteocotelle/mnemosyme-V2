import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RoomService } from './services/room.service';
import { GameFlowService } from './services/game-flow.service';
import { CorrectionService } from './services/correction.service';
import { ReconnectionService } from './services/reconnection.service';
import { CategoryCacheService } from '../questions/category-cache.service';
import { CHAT_MAX_LENGTH } from './game.constants';
import type { Room } from './interfaces/game.interfaces';
import type {
  CreateRoomPayload,
  JoinRoomPayload,
  UpdateGameSettingsPayload,
  StartGamePayload,
  SubmitAnswerPayload,
  ToggleValidationPayload,
  ValidateAllPayload,
  NextCorrectionPayload,
  RestartGamePayload,
  ChatMessagePayload,
  RequestRoomDataPayload,
  RoomDataEvent,
} from './interfaces/events.interfaces';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
  },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly roomService: RoomService,
    private readonly gameFlowService: GameFlowService,
    private readonly correctionService: CorrectionService,
    private readonly reconnectionService: ReconnectionService,
    private readonly categoryCacheService: CategoryCacheService,
  ) {}

  afterInit(server: Server) {
    this.gameFlowService.server = server;
    this.correctionService.server = server;
  }

  handleConnection(client: Socket) {
    console.log(`✅ Client connecté: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`🔴 Client déconnecté: ${client.id}`);

    const result = this.roomService.removePlayer(client.id);
    if (!result) return;

    const { roomId, room } = result;
    this.broadcastRoomData(room);

    if (room.phase === 'correction') {
      this.correctionService.sendCorrectionData(roomId);
    }
  }

  // --- Room Management ---

  @SubscribeMessage('createRoom')
  async handleCreateRoom(
    @MessageBody() data: CreateRoomPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.roomService.createRoom(client.id, data.pseudo, data.avatar);

    if (!room) {
      client.emit('errorMsg', 'Nombre maximum de salons atteint');
      return;
    }

    client.join(room.id);
    client.emit('roomCreated', { roomId: room.id });
    this.broadcastRoomData(room);

    // Send available categories
    const categories = await this.categoryCacheService.getCategories();
    client.emit('availableCategories', { categories });
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @MessageBody() data: JoinRoomPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const pseudo = data.pseudo || data.name || '';
    const result = this.roomService.joinRoom(data.roomId, client.id, pseudo, data.avatar);

    if (!result) {
      client.emit('errorMsg', 'Salle introuvable, pleine ou partie commencée');
      return;
    }

    const { room, player, isReconnection } = result;
    client.join(room.id);
    client.emit('roomJoined', { roomId: room.id });
    this.broadcastRoomData(room);

    if (isReconnection) {
      // Send current state snapshot to reconnecting player
      const snapshot = this.reconnectionService.buildStateSnapshot(room);
      client.emit('reconnectionState', snapshot);

      // Notify others
      this.server.to(room.id).emit('playerReconnected', {
        socketId: player.socketId,
        playerName: player.name,
      });
    }
  }

  @SubscribeMessage('requestRoomData')
  handleRequestRoomData(
    @MessageBody() data: RequestRoomDataPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.roomService.getRoom(data.roomId);
    if (!room) return;

    const roomData = this.buildRoomDataEvent(room);
    client.emit('roomData', roomData);
  }

  // --- Game Settings ---

  @SubscribeMessage('updateGameSettings')
  async handleUpdateGameSettings(
    @MessageBody() data: UpdateGameSettingsPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.roomService.getRoom(data.roomId);
    if (!room) return;
    if (!this.assertCreator(room, client)) return;
    if (room.phase !== 'lobby') return;

    this.roomService.updateSettings(room, data.settings);
    this.roomService.touchRoom(room);

    this.server.to(room.id).emit('gameSettings', { settings: room.settings });
  }

  @SubscribeMessage('requestCategories')
  async handleRequestCategories(
    @ConnectedSocket() client: Socket,
  ) {
    const categories = await this.categoryCacheService.getCategories();
    client.emit('availableCategories', { categories });
  }

  // --- Game Flow ---

  @SubscribeMessage('startGame')
  handleStartGame(
    @MessageBody() data: StartGamePayload,
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.roomService.getRoom(data.roomId);
    if (!room) return;
    if (!this.assertCreator(room, client)) return;

    this.gameFlowService.startGame(data.roomId);
  }

  @SubscribeMessage('submitAnswer')
  handleSubmitAnswer(
    @MessageBody() data: SubmitAnswerPayload,
    @ConnectedSocket() client: Socket,
  ) {
    this.gameFlowService.submitAnswer(data.roomId, client.id, data.answer, data.questionIndex);
  }

  // --- Correction ---

  @SubscribeMessage('toggleValidation')
  handleToggleValidation(
    @MessageBody() data: ToggleValidationPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.roomService.getRoom(data.roomId);
    if (!room) return;
    if (!this.assertCreator(room, client)) return;

    this.correctionService.toggleValidation(data.roomId, data.targetSocketId);
  }

  @SubscribeMessage('validateAll')
  handleValidateAll(
    @MessageBody() data: ValidateAllPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.roomService.getRoom(data.roomId);
    if (!room) return;
    if (!this.assertCreator(room, client)) return;

    this.correctionService.validateAllPlayers(data.roomId, data.isCorrect);
  }

  @SubscribeMessage('nextCorrection')
  handleNextCorrection(
    @MessageBody() data: NextCorrectionPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.roomService.getRoom(data.roomId);
    if (!room) return;
    if (!this.assertCreator(room, client)) return;

    this.correctionService.nextCorrection(data.roomId);
  }

  @SubscribeMessage('requestCorrectionData')
  handleRequestCorrectionData(
    @MessageBody() data: RequestRoomDataPayload,
  ) {
    this.correctionService.sendCorrectionData(data.roomId);
  }

  // --- Restart ---

  @SubscribeMessage('restartGame')
  handleRestartGame(
    @MessageBody() data: RestartGamePayload,
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.roomService.getRoom(data.roomId);
    if (!room) return;
    if (!this.assertCreator(room, client)) return;

    this.roomService.restartGame(room);
    this.server.to(room.id).emit('gameRestarted');
    this.broadcastRoomData(room);
  }

  // --- Chat ---

  @SubscribeMessage('chatMessage')
  handleChatMessage(
    @MessageBody() data: ChatMessagePayload,
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.roomService.getRoom(data.roomId);
    if (!room) return;

    // Chat active during lobby and result only
    if (room.phase !== 'lobby' && room.phase !== 'result') return;

    const player = room.players.find(p => p.socketId === client.id);
    if (!player) return;

    this.server.to(data.roomId).emit('newChatMessage', {
      pseudo: player.name,
      avatar: player.avatar,
      message: data.message.slice(0, CHAT_MAX_LENGTH),
      timestamp: Date.now(),
    });
  }

  // --- Helpers ---

  private assertCreator(room: Room, client: Socket): boolean {
    if (!this.roomService.isCreator(room, client.id)) {
      client.emit('errorMsg', 'Seul le créateur peut effectuer cette action');
      return false;
    }
    return true;
  }

  private buildRoomDataEvent(room: Room): RoomDataEvent {
    return {
      roomId: room.id,
      players: room.players,
      creatorSocketId: room.creatorSocketId,
      phase: room.phase,
      settings: room.settings,
    };
  }

  private broadcastRoomData(room: Room): void {
    this.server.to(room.id).emit('roomData', this.buildRoomDataEvent(room));
  }
}
