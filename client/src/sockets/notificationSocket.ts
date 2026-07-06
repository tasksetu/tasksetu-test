/**
 * HTTP Server interface
 */
interface HTTPServer {
  listen(port: number, callback?: () => void): void;
}

/**
 * Socket.IO Server interface for dependency injection
 */
interface SocketIOServer {
  use(middleware: (socket: any, next: any) => void): void;
  on(event: string, handler: (socket: any) => void): void;
  to(room: string): {
    emit(event: string, data: any): void;
  };
  emit(event: string, data: any): void;
  sockets: {
    sockets: Map<string, any>;
    adapter: {
      rooms: Map<string, Set<string>>;
    };
  };
  close(): void;
}

/**
 * Socket interface
 */
interface Socket {
  id: string;
  handshake: {
    auth: any;
    headers: any;
    address: string;
  };
  join(room: string): void;
  emit(event: string, data: any): void;
  on(event: string, handler: (...args: any[]) => void): void;
}

/**
 * JWT library interface
 */
interface JWT {
  verify(token: string, secret: string): any;
}

/**
 * Logger interface for dependency injection
 */
interface Logger {
  info(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
}

/**
 * JWT payload interface
 */
interface JWTPayload {
  userId: string;
  email?: string;
  role?: string;
  iat?: number;
  exp?: number;
}

/**
 * Socket with authenticated user information
 */
interface AuthenticatedSocket extends Socket {
  userId?: string;
  userEmail?: string;
  userRole?: string;
}

/**
 * Notification Socket.IO setup and management
 */
class NotificationSocket {
  private io: SocketIOServer;
  private logger: Logger;
  private jwtSecret: string;
  private jwt: JWT;

  constructor(
    io: SocketIOServer,
    jwt: JWT,
    logger: Logger,
    jwtSecret: string
  ) {
    this.io = io;
    this.jwt = jwt;
    this.logger = logger;
    this.jwtSecret = jwtSecret;
    
    this.setupMiddleware();
    this.setupConnectionHandlers();
  }

  /**
   * Setup Socket.IO middleware for authentication
   * @private
   */
  private setupMiddleware(): void {
    // JWT Authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization;
        
        if (!token) {
          this.logger.warn('Socket connection attempted without token', {
            socket_id: socket.id,
            ip: socket.handshake.address
          });
          return next(new Error('Authentication token required'));
        }

        // Remove 'Bearer ' prefix if present
        const cleanToken = token.replace('Bearer ', '');

        // Verify JWT token
        const decoded = this.jwt.verify(cleanToken, this.jwtSecret) as JWTPayload;

        if (!decoded.userId) {
          this.logger.warn('Invalid token payload - missing userId', {
            socket_id: socket.id,
            token_payload: decoded
          });
          return next(new Error('Invalid token payload'));
        }

        // Attach user information to socket
        socket.userId = decoded.userId;
        socket.userEmail = decoded.email;
        socket.userRole = decoded.role;

        this.logger.info('Socket authentication successful', {
          socket_id: socket.id,
          user_id: decoded.userId,
          user_email: decoded.email,
          user_role: decoded.role
        });

        next();

      } catch (error) {
        this.logger.error('Socket authentication failed', {
          socket_id: socket.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          ip: socket.handshake.address
        });
        next(new Error('Authentication failed'));
      }
    });
  }

  /**
   * Setup connection event handlers
   * @private
   */
  private setupConnectionHandlers(): void {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      this.handleConnection(socket);
    });
  }

  /**
   * Handle new socket connection
   * @private
   * @param socket - Authenticated socket instance
   */
  private handleConnection(socket: AuthenticatedSocket): void {
    const userId = socket.userId!;
    const roomName = `user_${userId}`;

    // Join user to their personal room
    socket.join(roomName);

    this.logger.info('User connected to notification socket', {
      socket_id: socket.id,
      user_id: userId,
      user_email: socket.userEmail,
      room_name: roomName,
      connected_sockets: this.getConnectedSocketCount(userId)
    });

    // Setup event handlers for this socket
    this.setupSocketEventHandlers(socket);

    // Handle disconnection
    socket.on('disconnect', (reason: string) => {
      this.handleDisconnection(socket, reason);
    });

    // Send connection confirmation
    socket.emit('connection_confirmed', {
      user_id: userId,
      room_name: roomName,
      timestamp: new Date(),
      message: 'Successfully connected to notification service'
    });
  }

  /**
   * Setup event handlers for individual socket
   * @private
   * @param socket - Authenticated socket instance
   */
  private setupSocketEventHandlers(socket: AuthenticatedSocket): void {
    const userId = socket.userId!;

    // Handle notification acknowledgment
    socket.on('notification_acknowledged', (data: { notification_id: string }) => {
      this.logger.info('Notification acknowledged by user', {
        socket_id: socket.id,
        user_id: userId,
        notification_id: data.notification_id
      });
    });

    // Handle notification read status update
    socket.on('notification_read', (data: { notification_id: string }) => {
      this.logger.info('Notification marked as read', {
        socket_id: socket.id,
        user_id: userId,
        notification_id: data.notification_id
      });
    });

    // Handle bulk notification actions
    socket.on('mark_all_read', () => {
      this.logger.info('Mark all notifications as read requested', {
        socket_id: socket.id,
        user_id: userId
      });
      // Emit confirmation back to client
      socket.emit('all_notifications_read', { timestamp: new Date() });
    });

    // Handle notification preferences update
    socket.on('update_preferences', (data: any) => {
      this.logger.info('Notification preferences update requested', {
        socket_id: socket.id,
        user_id: userId,
        preferences: data
      });
    });

    // Handle ping/pong for connection health
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date() });
    });

    // Handle error events
    socket.on('error', (error: Error) => {
      this.logger.error('Socket error occurred', {
        socket_id: socket.id,
        user_id: userId,
        error: error.message
      });
    });
  }

  /**
   * Handle socket disconnection
   * @private
   * @param socket - Authenticated socket instance
   * @param reason - Disconnection reason
   */
  private handleDisconnection(socket: AuthenticatedSocket, reason: string): void {
    const userId = socket.userId!;

    this.logger.info('User disconnected from notification socket', {
      socket_id: socket.id,
      user_id: userId,
      user_email: socket.userEmail,
      reason: reason,
      remaining_sockets: this.getConnectedSocketCount(userId)
    });
  }

  /**
   * Get the Socket.IO server instance
   * @returns SocketIO server instance
   */
  getIOInstance(): SocketIOServer {
    return this.io;
  }

  /**
   * Get count of connected sockets for a user
   * @param userId - User ID
   * @returns Number of connected sockets
   */
  getConnectedSocketCount(userId: string): number {
    try {
      const roomName = `user_${userId}`;
      const room = this.io.sockets.adapter.rooms.get(roomName);
      return room ? room.size : 0;
    } catch (error) {
      this.logger.error('Failed to get socket count', {
        user_id: userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return 0;
    }
  }

  /**
   * Check if user is currently online
   * @param userId - User ID
   * @returns True if user has connected sockets
   */
  isUserOnline(userId: string): boolean {
    return this.getConnectedSocketCount(userId) > 0;
  }

  /**
   * Send notification to specific user
   * @param userId - User ID
   * @param eventName - Socket event name
   * @param data - Data to send
   */
  sendToUser(userId: string, eventName: string, data: any): void {
    try {
      const roomName = `user_${userId}`;
      this.io.to(roomName).emit(eventName, data);

      this.logger.info('Message sent to user', {
        user_id: userId,
        room_name: roomName,
        event_name: eventName,
        connected_sockets: this.getConnectedSocketCount(userId)
      });
    } catch (error) {
      this.logger.error('Failed to send message to user', {
        user_id: userId,
        event_name: eventName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Broadcast to all connected sockets
   * @param eventName - Socket event name
   * @param data - Data to broadcast
   */
  broadcast(eventName: string, data: any): void {
    try {
      this.io.emit(eventName, data);
      
      this.logger.info('Message broadcasted to all users', {
        event_name: eventName,
        total_sockets: this.io.sockets.sockets.size
      });
    } catch (error) {
      this.logger.error('Failed to broadcast message', {
        event_name: eventName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get all online users
   * @returns Array of online user IDs
   */
  getOnlineUsers(): string[] {
    try {
      const onlineUsers: string[] = [];
      
      for (const [socketId, socket] of this.io.sockets.sockets) {
        const authSocket = socket as AuthenticatedSocket;
        if (authSocket.userId && !onlineUsers.includes(authSocket.userId)) {
          onlineUsers.push(authSocket.userId);
        }
      }

      this.logger.info('Online users retrieved', {
        online_count: onlineUsers.length,
        total_sockets: this.io.sockets.sockets.size
      });

      return onlineUsers;
    } catch (error) {
      this.logger.error('Failed to get online users', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  /**
   * Close the Socket.IO server
   */
  close(): void {
    this.logger.info('Closing notification socket server');
    this.io.close();
  }
}

/**
 * Setup notification socket system
 * @param io - Socket.IO server instance
 * @param jwt - JWT library instance
 * @param logger - Logger instance
 * @param jwtSecret - JWT secret for authentication
 * @returns NotificationSocket instance
 */
export function setupNotificationSocket(
  io: SocketIOServer,
  jwt: JWT,
  logger: Logger,
  jwtSecret: string
): NotificationSocket {
  return new NotificationSocket(io, jwt, logger, jwtSecret);
}

export { NotificationSocket };