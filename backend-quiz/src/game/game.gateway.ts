import { 
  WebSocketGateway, 
  SubscribeMessage, 
  MessageBody, 
  ConnectedSocket, 
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit // Nécessaire pour afterInit
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameService } from './game.service';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || '*', // L'adresse de ton Front Svelte
    credentials: true
  },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  
  @WebSocketServer()
  server: Server;

  constructor(private gameService: GameService) {}

  // --- INITIALISATION ---
  // Cette méthode est appelée automatiquement quand le module Websocket démarre
  afterInit(server: Server) {
    // On injecte l'instance du serveur Socket.io dans le Service
    // Cela permet au Service d'envoyer des messages (emit) sans passer par le Gateway
    this.gameService.server = server;
  }

  handleConnection(client: Socket) {
    console.log(`Client connecté: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client déconnecté: ${client.id}`);
    
    const roomId = this.gameService.removePlayer(client.id);

    if (roomId) {
      const room = this.gameService.getRoom(roomId);
      if (room) {
        // Mise à jour du Lobby (si on est dans le lobby)
        this.server.to(roomId).emit('roomData', {
          roomId: room.id,
          players: room.players,
          creatorSocketId: room.creatorSocketId
        });

        // FIX FANTÔME : Si on est en correction, on force une mise à jour immédiate
        // pour que le joueur apparaisse "Grisé/Offline" tout de suite
        if (room.status === 'correction') {
           this.gameService.sendCorrectionData(roomId);
        }
      }
    }
  }

  // --- ÉVÉNEMENTS DU JEU ---

  @SubscribeMessage('createRoom')
  handleCreateRoom(
    @MessageBody() data: { pseudo: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gameService.createRoom(client.id, data.pseudo);
    
    // 1. On fait rejoindre la socket rooms
    client.join(room.id);
    
    // 2. On répond au créateur
    client.emit('roomCreated', { roomId: room.id });
    
    // 3. On met à jour l'affichage
    this.server.to(room.id).emit('roomData', {
      roomId: room.id,
      players: room.players,
      creatorSocketId: room.creatorSocketId
    });
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @MessageBody() data: { roomId: string; pseudo: string },
    @ConnectedSocket() client: Socket,
  ) {
    // Support pour "name" ou "pseudo" selon ton front
    const pseudo = data.pseudo || (data as any).name;

    const room = this.gameService.joinRoom(data.roomId, client.id, pseudo);

    if (!room) {
      client.emit('errorMsg', 'Salle introuvable ou partie commencée');
      return;
    }

    client.join(room.id);
    
    client.emit('roomJoined', { roomId: room.id });

    this.server.to(room.id).emit('roomData', {
      roomId: room.id,
      players: room.players,
      creatorSocketId: room.creatorSocketId
    });
  }

  @SubscribeMessage('requestRoomData')
  handleRequestRoomData(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gameService.getRoom(data.roomId);
    
    if (room) {
      client.emit('roomData', {
        roomId: room.id,
        players: room.players,
        creatorSocketId: room.creatorSocketId
      });
    }
  }

  // --- NOUVELLES MÉTHODES AJOUTÉES ---

  @SubscribeMessage('startGame')
  handleStartGame(
    @MessageBody() data: { roomId: string }, 
    @ConnectedSocket() client: Socket
  ) {
    // Idéalement, on devrait vérifier ici ou dans le service si client.id est bien le créateur
    this.gameService.startGame(data.roomId); 
  }

  @SubscribeMessage('submitAnswer')
  handleSubmitAnswer(
    @MessageBody() data: { roomId: string, answer: string, questionIndex?: number }, 
    @ConnectedSocket() client: Socket
  ) {
    this.gameService.submitAnswer(data.roomId, client.id, data.answer, data.questionIndex);
  }

  @SubscribeMessage('toggleValidation')
  handleToggleValidation(
    @MessageBody() data: { roomId: string, targetSocketId: string },
    @ConnectedSocket() client: Socket
  ) {
    // Sécurité : vérifier si client.id === creatorSocketId (optionnel mais mieux)
    this.gameService.toggleValidation(data.roomId, data.targetSocketId);
  }

  @SubscribeMessage('nextCorrection')
  handleNextCorrection(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket
  ) {
    this.gameService.nextCorrection(data.roomId);
  }
  
  // Ajoute aussi un écouteur pour charger la correction si on refresh la page
  @SubscribeMessage('requestCorrectionData')
  handleRequestCorrection(@MessageBody() data: { roomId: string }) {
     this.gameService.sendCorrectionData(data.roomId);
  }

  @SubscribeMessage('restartGame')
  handleRestartGame(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket
  ) {
    // Idéalement vérifier si c'est le créateur
    this.gameService.restartGame(data.roomId);
  }
}