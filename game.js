// Game client for Mini MMORPG
class GameClient {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.worldImage = null;
        this.worldSize = 2048; // World map is 2048x2048 pixels
        
        // WebSocket connection
        this.socket = null;
        this.serverUrl = 'wss://codepath-mmorg.onrender.com';
        
        // Game state
        this.myPlayerId = null;
        this.players = {};
        this.avatars = {};
        this.myPosition = { x: 0, y: 0 };
        
        // Camera/viewport system
        this.camera = {
            x: 0,
            y: 0,
            width: 0,
            height: 0
        };
        
        // Avatar image cache
        this.avatarImages = {};
        this.customAvatar = null;
        
        // Emote system
        this.activeEmotes = {}; // Track active emotes for each player
        this.emoteDuration = 3000; // 3 seconds
        
        // Chat system
        this.chatMessages = [];
        this.maxChatMessages = 50;
        
        // Movement controls
        this.pressedKeys = new Set();
        this.movementKeys = {
            'ArrowUp': 'up',
            'ArrowDown': 'down',
            'ArrowLeft': 'left',
            'ArrowRight': 'right'
        };
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.loadWorldMap();
        this.setupKeyboardControls();
        this.setupAvatarUpload();
        this.setupEmotes();
        this.setupChat();
        this.connectToServer();
    }
    
    setupCanvas() {
        // Set canvas size to fill the browser window
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.updateCamera();
            this.render();
        });
    }
    
    loadWorldMap() {
        this.worldImage = new Image();
        this.worldImage.onload = () => {
            this.updateCamera();
            this.render();
        };
        this.worldImage.onerror = () => {
            console.error('Failed to load world map image');
        };
        this.worldImage.src = 'world.jpg';
    }
    
    // Keyboard controls
    setupKeyboardControls() {
        document.addEventListener('keydown', (event) => {
            this.handleKeyDown(event);
        });
        
        document.addEventListener('keyup', (event) => {
            this.handleKeyUp(event);
        });
    }
    
    handleKeyDown(event) {
        // Handle emote shortcuts first
        if (event.code.startsWith('Digit')) {
            // Let emote system handle digit keys
            return;
        }
        
        // Only handle movement keys
        if (!this.movementKeys[event.code]) return;
        
        // Prevent default browser behavior (scrolling)
        event.preventDefault();
        
        // Add key to pressed keys set
        this.pressedKeys.add(event.code);
        
        // Send move command to server
        const direction = this.movementKeys[event.code];
        this.sendMoveCommand(direction);
    }
    
    handleKeyUp(event) {
        // Only handle movement keys
        if (!this.movementKeys[event.code]) return;
        
        // Remove key from pressed keys set
        this.pressedKeys.delete(event.code);
        
        // If no movement keys are pressed, send stop command
        if (this.pressedKeys.size === 0) {
            this.sendStopCommand();
        }
    }
    
    sendMoveCommand(direction) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
        
        const message = {
            action: 'move',
            direction: direction
        };
        this.socket.send(JSON.stringify(message));
    }
    
    sendStopCommand() {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
        
        const message = {
            action: 'stop'
        };
        this.socket.send(JSON.stringify(message));
    }
    
    // Avatar upload functionality
    setupAvatarUpload() {
        const uploadButton = document.getElementById('uploadButton');
        const avatarFile = document.getElementById('avatarFile');
        
        uploadButton.addEventListener('click', () => {
            avatarFile.click();
        });
        
        avatarFile.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                this.processAvatarFile(file);
            }
        });
    }
    
    processAvatarFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.createCustomAvatar(img);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
    
    createCustomAvatar(img) {
        // Create a simple 3-frame animation for each direction
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Resize image to 32x32 for avatar
        canvas.width = 32;
        canvas.height = 32;
        ctx.drawImage(img, 0, 0, 32, 32);
        
        const base64Image = canvas.toDataURL('image/png');
        
        // Create avatar data structure
        this.customAvatar = {
            name: 'custom_avatar',
            frames: {
                north: [base64Image, base64Image, base64Image],
                south: [base64Image, base64Image, base64Image],
                east: [base64Image, base64Image, base64Image]
            }
        };
        
        // If already connected, send the custom avatar
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.rejoinWithCustomAvatar();
        }
    }
    
    rejoinWithCustomAvatar() {
        if (!this.customAvatar) return;
        
        const message = {
            action: 'join_game',
            username: 'Melvin',
            avatar: this.customAvatar
        };
        this.socket.send(JSON.stringify(message));
    }
    
    // Emote system
    setupEmotes() {
        const emoteButtons = document.querySelectorAll('.emote-btn');
        emoteButtons.forEach(button => {
            button.addEventListener('click', () => {
                const emote = button.getAttribute('data-emote');
                this.sendEmote(emote);
            });
        });
        
        // Add keyboard shortcuts for emotes
        document.addEventListener('keydown', (event) => {
            if (event.code === 'Digit1') this.sendEmote('wave');
            if (event.code === 'Digit2') this.sendEmote('dance');
            if (event.code === 'Digit3') this.sendEmote('jump');
            if (event.code === 'Digit4') this.sendEmote('heart');
            if (event.code === 'Digit5') this.sendEmote('laugh');
            if (event.code === 'Digit6') this.sendEmote('thumbsup');
        });
    }
    
    sendEmote(emoteType) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
        
        const message = {
            action: 'emote',
            emote: emoteType
        };
        this.socket.send(JSON.stringify(message));
        
        // Show emote locally immediately
        this.showEmote(this.myPlayerId, emoteType);
    }
    
    showEmote(playerId, emoteType) {
        this.activeEmotes[playerId] = {
            type: emoteType,
            startTime: Date.now()
        };
        
        // Auto-remove emote after duration
        setTimeout(() => {
            delete this.activeEmotes[playerId];
            this.render();
        }, this.emoteDuration);
        
        this.render();
    }
    
    // Chat system
    setupChat() {
        const chatInput = document.getElementById('chatMessageInput');
        const chatMessages = document.getElementById('chatMessages');
        
        // Handle Enter key to send message
        chatInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                const message = chatInput.value.trim();
                if (message) {
                    this.sendChatMessage(message);
                    chatInput.value = '';
                }
            }
        });
        
        // Focus chat input when clicking on chat panel
        chatMessages.addEventListener('click', () => {
            chatInput.focus();
        });
        
        // Add welcome message
        this.addChatMessage('System', 'Welcome to the game! Type messages to chat with other players.', 'system');
    }
    
    sendChatMessage(message) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
        
        const chatMessage = {
            action: 'chat',
            message: message
        };
        this.socket.send(JSON.stringify(chatMessage));
        
        // Add message to local chat immediately
        this.addChatMessage('You', message, 'own');
    }
    
    addChatMessage(username, message, type = 'other') {
        const timestamp = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const chatMessage = {
            username,
            message,
            timestamp,
            type
        };
        
        this.chatMessages.push(chatMessage);
        
        // Limit number of messages
        if (this.chatMessages.length > this.maxChatMessages) {
            this.chatMessages.shift();
        }
        
        this.renderChat();
    }
    
    renderChat() {
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.innerHTML = '';
        
        this.chatMessages.forEach(msg => {
            const messageDiv = document.createElement('div');
            messageDiv.style.marginBottom = '4px';
            messageDiv.style.wordWrap = 'break-word';
            
            let color = '#ffffff';
            let prefix = '';
            
            switch (msg.type) {
                case 'own':
                    color = '#4CAF50';
                    prefix = 'You: ';
                    break;
                case 'system':
                    color = '#FFC107';
                    prefix = '[System] ';
                    break;
                case 'other':
                    color = '#ffffff';
                    prefix = `${msg.username}: `;
                    break;
            }
            
            messageDiv.innerHTML = `
                <span style="color: #888; font-size: 10px;">${msg.timestamp}</span>
                <span style="color: ${color}; font-weight: ${msg.type === 'own' ? 'bold' : 'normal'};">${prefix}${msg.message}</span>
            `;
            
            chatMessages.appendChild(messageDiv);
        });
        
        // Auto-scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // WebSocket connection
    connectToServer() {
        this.socket = new WebSocket(this.serverUrl);
        
        this.socket.onopen = () => {
            console.log('Connected to game server');
            this.joinGame();
        };
        
        this.socket.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.handleMessage(message);
            } catch (error) {
                console.error('Failed to parse server message:', error);
            }
        };
        
        this.socket.onclose = () => {
            console.log('Disconnected from game server');
        };
        
        this.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }
    
    joinGame() {
        const message = {
            action: 'join_game',
            username: 'Melvin'
        };
        
        // Add custom avatar if available
        if (this.customAvatar) {
            message.avatar = this.customAvatar;
        }
        
        this.socket.send(JSON.stringify(message));
    }
    
    handleMessage(message) {
        switch (message.action) {
            case 'join_game':
                if (message.success) {
                    this.myPlayerId = message.playerId;
                    this.players = message.players;
                    this.avatars = message.avatars;
                    this.loadAvatarImages();
                    this.updateMyPosition();
                    this.updateCamera();
                    this.addChatMessage('System', 'Successfully joined the game!', 'system');
                    this.render();
                } else {
                    console.error('Failed to join game:', message.error);
                    this.addChatMessage('System', `Failed to join game: ${message.error}`, 'system');
                }
                break;
                
            case 'players_moved':
                this.players = { ...this.players, ...message.players };
                this.updateMyPosition();
                this.updateCamera();
                this.render();
                break;
                
            case 'player_joined':
                this.players[message.player.id] = message.player;
                this.avatars[message.avatar.name] = message.avatar;
                this.loadAvatarImage(message.avatar);
                this.addChatMessage('System', `${message.player.username} joined the game!`, 'system');
                this.render();
                break;
                
            case 'player_left':
                const leftPlayer = this.players[message.playerId];
                delete this.players[message.playerId];
                delete this.activeEmotes[message.playerId];
                if (leftPlayer) {
                    this.addChatMessage('System', `${leftPlayer.username} left the game.`, 'system');
                }
                this.render();
                break;
                
            case 'emote':
                this.showEmote(message.playerId, message.emote);
                break;
                
            case 'chat':
                this.addChatMessage(message.username, message.message, 'other');
                break;
        }
    }
    
    updateMyPosition() {
        if (this.myPlayerId && this.players[this.myPlayerId]) {
            this.myPosition = {
                x: this.players[this.myPlayerId].x,
                y: this.players[this.myPlayerId].y
            };
        }
    }
    
    // Camera/viewport system
    updateCamera() {
        this.camera.width = this.canvas.width;
        this.camera.height = this.canvas.height;
        
        // Center camera on player position
        this.camera.x = this.myPosition.x - this.camera.width / 2;
        this.camera.y = this.myPosition.y - this.camera.height / 2;
        
        // Clamp camera to world boundaries
        this.camera.x = Math.max(0, Math.min(this.camera.x, this.worldSize - this.camera.width));
        this.camera.y = Math.max(0, Math.min(this.camera.y, this.worldSize - this.camera.height));
    }
    
    // Avatar image loading and caching
    loadAvatarImages() {
        for (const avatarName in this.avatars) {
            this.loadAvatarImage(this.avatars[avatarName]);
        }
    }
    
    loadAvatarImage(avatar) {
        if (this.avatarImages[avatar.name]) return; // Already loaded
        
        this.avatarImages[avatar.name] = {};
        
        // Load all frames for each direction
        ['north', 'south', 'east'].forEach(direction => {
            this.avatarImages[avatar.name][direction] = [];
            avatar.frames[direction].forEach((frameData, index) => {
                const img = new Image();
                img.onload = () => {
                    this.avatarImages[avatar.name][direction][index] = img;
                    this.render(); // Re-render when new avatar loads
                };
                img.src = frameData;
            });
        });
    }
    
    // Main render function
    render() {
        if (!this.worldImage) return;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw world map with camera offset
        this.ctx.drawImage(
            this.worldImage,
            this.camera.x, this.camera.y, this.camera.width, this.camera.height,  // Source: visible portion
            0, 0, this.camera.width, this.camera.height  // Destination: full canvas
        );
        
        // Draw avatars
        this.drawAvatars();
    }
    
    drawAvatars() {
        for (const playerId in this.players) {
            const player = this.players[playerId];
            this.drawAvatar(player);
        }
    }
    
    drawAvatar(player) {
        // Convert world coordinates to screen coordinates
        const screenX = player.x - this.camera.x;
        const screenY = player.y - this.camera.y;
        
        // Skip if avatar is outside viewport
        if (screenX < -50 || screenX > this.camera.width + 50 || 
            screenY < -50 || screenY > this.camera.height + 50) {
            return;
        }
        
        const avatar = this.avatars[player.avatar];
        if (!avatar || !this.avatarImages[player.avatar]) return;
        
        // Get the appropriate frame
        const direction = player.facing;
        const frameIndex = player.animationFrame || 0;
        
        // For west direction, use east frames and flip horizontally
        const frameDirection = direction === 'west' ? 'east' : direction;
        const frames = this.avatarImages[player.avatar][frameDirection];
        
        if (!frames || !frames[frameIndex]) return;
        
        const avatarImg = frames[frameIndex];
        
        // Calculate avatar size (preserve aspect ratio)
        const avatarSize = 32; // Base size
        const aspectRatio = avatarImg.width / avatarImg.height;
        const width = avatarSize * aspectRatio;
        const height = avatarSize;
        
        // Draw avatar
        this.ctx.save();
        
        // For west direction, flip horizontally
        if (direction === 'west') {
            this.ctx.scale(-1, 1);
            this.ctx.drawImage(avatarImg, -screenX - width/2, screenY - height/2, width, height);
        } else {
            this.ctx.drawImage(avatarImg, screenX - width/2, screenY - height/2, width, height);
        }
        
        this.ctx.restore();
        
        // Draw username label
        this.ctx.save();
        this.ctx.fillStyle = 'white';
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 2;
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        
        const textY = screenY - height/2 - 5;
        this.ctx.strokeText(player.username, screenX, textY);
        this.ctx.fillText(player.username, screenX, textY);
        
        this.ctx.restore();
        
        // Draw emote if active
        this.drawEmote(player.id, screenX, screenY - height/2 - 20);
    }
    
    drawEmote(playerId, screenX, screenY) {
        const emote = this.activeEmotes[playerId];
        if (!emote) return;
        
        const elapsed = Date.now() - emote.startTime;
        const progress = elapsed / this.emoteDuration;
        
        // Fade out effect
        const alpha = Math.max(0, 1 - progress);
        
        this.ctx.save();
        this.ctx.globalAlpha = alpha;
        this.ctx.font = '24px Arial';
        this.ctx.textAlign = 'center';
        
        // Add bounce effect
        const bounce = Math.sin(progress * Math.PI * 4) * 5;
        const emoteY = screenY + bounce;
        
        // Get emote emoji
        const emoteEmojis = {
            wave: '👋',
            dance: '💃',
            jump: '🦘',
            heart: '❤️',
            laugh: '😂',
            thumbsup: '👍'
        };
        
        const emoji = emoteEmojis[emote.type] || '😊';
        
        // Draw emote with shadow
        this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
        this.ctx.fillText(emoji, screenX + 2, emoteY + 2);
        this.ctx.fillStyle = 'white';
        this.ctx.fillText(emoji, screenX, emoteY);
        
        this.ctx.restore();
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new GameClient();
});
