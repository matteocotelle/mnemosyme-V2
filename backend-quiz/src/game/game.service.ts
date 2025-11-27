import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Room, Player } from './interfaces/game.interfaces';
import { QuestionsService } from '../questions/questions.service';
import { Server } from 'socket.io';

@Injectable()
export class GameService {
  private rooms = new Map<string, Room>();
  public server: Server;

  constructor(private questionsService: QuestionsService) {}

  createRoom(clientSocketId: string, pseudo: string): Room {
    const roomId = uuidv4().split('-')[0];
    const newRoom: Room = {
      id: roomId,
      creatorSocketId: clientSocketId,
      players: [],
      status: 'lobby',
      questions: [],
      currentQuestionIndex: 0,
      answers: [],    // Tableau vide au départ
      timer: null,
      correctionQuestionIndex: 0,
      validatedAnswers: new Map()
    };
    
    // On ajoute le créateur comme joueur
    this.addPlayerToRoom(newRoom, clientSocketId, pseudo);
    
    this.rooms.set(roomId, newRoom);
    return newRoom;
  }

  joinRoom(roomId: string, clientSocketId: string, pseudo: string): Room | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const existingPlayer = room.players.find(p => p.name === pseudo && p.isDisconnected);
    
    // Si la partie a commencé ET que ce n'est pas une reconnexion, on bloque
    if (room.status !== 'lobby' && !existingPlayer) return null;

    this.addPlayerToRoom(room, clientSocketId, pseudo);
    
    // Si le joueur revient, on enlève le flag déconnecté
    const player = room.players.find(p => p.socketId === clientSocketId);
    if (player) delete player.isDisconnected;

    return room;
  }

  private addPlayerToRoom(room: Room, socketId: string, name: string) {
    // Évite les doublons si reconnexion
    const existing = room.players.find(p => p.name === name);
    if (existing) {
        existing.socketId = socketId; // Mise à jour du socket
    } else {
        room.players.push({ socketId, name, score: 0 });
    }
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  removePlayer(socketId: string): string | null {
    for (const [roomId, room] of this.rooms.entries()) {
      const playerIndex = room.players.findIndex(p => p.socketId === socketId);
      
      if (playerIndex !== -1) {
        const player = room.players[playerIndex];

        // CAS 1 : LOBBY -> On supprime
        if (room.status === 'lobby') {
            room.players.splice(playerIndex, 1);
            if (room.players.length === 0) {
                this.rooms.delete(roomId);
                return null;
            }
        } 
        // CAS 2 : JEU/CORRECTION -> On garde (Fantôme)
        else {
            player.isDisconnected = true;
        }

        // Gestion transmission du rôle Hôte
        if (room.creatorSocketId === socketId) {
            const nextCreator = room.players.find(p => !p.isDisconnected && p.socketId !== socketId);
            if (nextCreator) {
                room.creatorSocketId = nextCreator.socketId;
            } else if (room.players.length > 0) {
                room.creatorSocketId = room.players[0].socketId;
            } else {
                this.rooms.delete(roomId);
                return null;
            }
        }
        return roomId;
      }
    }
    return null;
  }

  startCorrection(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.status = 'correction';
    room.correctionQuestionIndex = 0;
    this.sendCorrectionData(roomId);
  }

  // Envoie l'état actuel (Question + Réponses des joueurs)
  sendCorrectionData(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const currentQIndex = room.correctionQuestionIndex;
    
    // Si on a dépassé la dernière question, c'est fini -> Podium
    if (currentQIndex >= room.questions.length) {
        // Calcul final des scores (optionnel si fait en temps réel)
        // Trier les joueurs par score 
        const leaderboard = room.players.sort((a, b) => b.score - a.score);
        this.server.to(roomId).emit('correctionFinished', { leaderboard });
        return;
    }

    const question = room.questions[currentQIndex];

    // On récupère les réponses pour CETTE question spécifique
    const answersForQuestion = room.answers.filter(a => a.questionIndex === currentQIndex);

    // On prépare la liste pour le front
    const playersData = room.players.map(p => {
        const playerAnswer = answersForQuestion.find(a => a.socketId === p.socketId);
        // On vérifie si c'est déjà validé
        const validationKey = `${p.socketId}-${currentQIndex}`;
        const isValid = room.validatedAnswers.get(validationKey);

        return {
            socketId: p.socketId,
            name: p.name,
            answer: playerAnswer ? playerAnswer.answer : "(Pas de réponse)",
            isCorrect: isValid // undefined, true, ou false
        };
    });

    const payload = {
        questionIndex: currentQIndex,
        total: room.questions.length,
        question: {
            text: question.question,
            answer: question.answer, // La bonne réponse (stockée dans ta DB)
            image: question.image,
            points: question.points || 1
        },
        players: playersData
    };

    this.server.to(roomId).emit('correctionState', payload);
  }

  // Action du Créateur : Valider/Invalider une réponse
  toggleValidation(roomId: string, targetSocketId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const key = `${targetSocketId}-${room.correctionQuestionIndex}`;
    const currentVal = room.validatedAnswers.get(key);
    
    // Bascule : undefined -> true -> false -> true...
    const newVal = currentVal === true ? false : true;
    room.validatedAnswers.set(key, newVal);

    // Mise à jour du score en temps réel
    const player = room.players.find(p => p.socketId === targetSocketId);
    if (player) {
        const points = room.questions[room.correctionQuestionIndex].points || 1;
        if (newVal === true) player.score += points;
        else if (currentVal === true) player.score -= points; // On retire si on change d'avis
    }

    // On renvoie l'état mis à jour à tout le monde
    this.sendCorrectionData(roomId);
  }

  // Action du Créateur : Passer à la suivante
  nextCorrection(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    
    room.correctionQuestionIndex++;
    this.sendCorrectionData(roomId);
  }

  restartGame(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    // 1. Réinitialiser l'état de la salle
    room.status = 'lobby';
    room.currentQuestionIndex = 0;
    room.correctionQuestionIndex = 0;
    room.questions = [];
    room.answers = [];
    room.timer = null;
    room.validatedAnswers = new Map();

    // 2. Réinitialiser les scores des joueurs (mais on les garde connectés !)
    room.players.forEach(p => p.score = 0);

    // 3. Prévenir tout le monde
    this.server.to(roomId).emit('gameRestarted');
  }

  async startGame(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    // 1. Récupérer 20 questions aléatoires
    room.questions = await this.questionsService.fetchRandomQuestions(3);
    room.status = 'playing';
    room.currentQuestionIndex = 0;

    // 2. Notifier que le jeu commence
    this.server.to(roomId).emit('gameStarted');

    // 3. Lancer la première question après un court délai (intro)
    setTimeout(() => this.nextQuestion(roomId), 2000); // Intro de 2s
  }

  private nextQuestion(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    if (room.currentQuestionIndex >= room.questions.length) {
      this.endGame(roomId);
      return;
    }

    const question = room.questions[room.currentQuestionIndex];

    // Payload envoyé aux joueurs (on masque la bonne réponse !)
    const payload = {
      index: room.currentQuestionIndex,
      total: room.questions.length,
      text: question.question, // Adapté à ton schéma DB
      image: question.image || null, // Si image
      seconds: 20 // Temps par question
    };

    // Envoyer la question
    this.server.to(roomId).emit('newQuestion', payload);

    // Démarrer le timer côté serveur
    let secondsLeft = 20;
    
    room.timer = setInterval(() => {
      secondsLeft--;
      if (secondsLeft <= 0) {
        
        if (room.timer) {
            clearInterval(room.timer);
            room.timer = null; // On le remet à null proprement
        }

        this.closeQuestion(roomId); 
      }
    }, 1000);
  }

  submitAnswer(roomId: string, socketId: string, answer: string, questionIndex?: number) {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'playing') return;

    console.log(`📥 BACK REÇOIT [Joueur ${socketId}] :`, {
        reponse: answer,
        indexRecu: questionIndex,
        indexActuelRoom: room.currentQuestionIndex
    });
    
    if (!room.answers) room.answers = [];
    
    // CORRECTION : On utilise l'index envoyé par le front s'il existe
    // Sinon on prend l'actuel (fallback)
    const targetIndex = (questionIndex !== undefined) ? questionIndex : room.currentQuestionIndex;

    // On vérifie si le joueur n'a pas déjà répondu à CETTE question précise
    const alreadyAnswered = room.answers.some(a => a.socketId === socketId && a.questionIndex === targetIndex);
    if (alreadyAnswered) return;

    room.answers.push({
      questionIndex: targetIndex, // On enregistre avec le BON index
      socketId,
      answer
    });
  }

  private closeQuestion(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    
    setTimeout(() => {
        room.currentQuestionIndex++; 
        this.nextQuestion(roomId);
    }, 2000);
  }

  private endGame(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.status = 'correction';
    this.server.to(roomId).emit('gameFinished'); // Redirigera vers /correction
  }

}