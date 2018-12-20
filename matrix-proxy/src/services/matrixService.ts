import * as sdk from 'matrix-js-sdk';
import * as ws from 'socket.io';
import * as Stomp from 'node-stomp';
import * as crypto from 'crypto';
import { log } from '../api/log';
// import {MatrixLogin} from '../models/matrix';

class MatrixService {

    matrixClient: any;
    stompClient: any;
    historyRead: boolean = false;
    accessToken: string = '';
    adminName: string = process.env.MATRIX_USER_NAME;
    adminPassword: string = process.env.MATRIX_USER_PASSWORD;
    socket = ws();
    clients: any[] = [];

    constructor() {
        this.matrixClient = sdk.createClient(process.env.MATRIX_HOST);
        this.stompClient = new Stomp.Stomp({
            host: process.env.ACTIVE_MQ_HOST,
            port: process.env.ACTIVE_MQ_PORT,
            login: process.env.ACTIVE_MQ_USER_NAME,
            passcode: process.env.ACTIVE_MQ_USER_PASSWORD,
            debug: true
        });
        this.startClient().then(() => {
            // Nothing to do here
        }).catch(error => {
            log.error('MATRIX [MatrixService::Service:startClient]: Error', {
                stack_trace: error,
                code: error.code
            });
            // TODO: manage error here
        });
    }

    startClient() {
        return new Promise<any>((resolve, reject) => {
            this.matrixClient.startClient().then(() => {
                this.authenticateAdmin().then(response => {
                    this.accessToken = response.access_token;
                    // TODO: TEST search - remove it after debugging
                    this.searchUsers('client').then(userList => {
                        log.info('MATRIX [MatrixService::Service:searchUsers]: Info', {content: userList});
                    }).catch(error => {
                        log.error('MATRIX [MatrixService::Service:searchUsers]: Error', {
                            stack_trace: error,
                            code: error.code
                        });
                    });
                    this.startSocket().then(socket => {
                        this.socket = socket;
                        this.stompConnect().then(() => {
                            resolve();
                        });
                    });
                });
            });
        });
    }

    authenticateAdmin() {
        return new Promise<any>((resolve, reject) => {
            let adminCredentials = {
                user_name: process.env.MATRIX_USER_NAME,
                password: process.env.MATRIX_USER_PASSWORD
            };
            this.authenticate(adminCredentials).then(response => {

                this.on('event', data => {
                    log.debug('MATRIX [MatrixService::Service:event]: Debug', {event_type: data.event.type});

                    if (data.event.type === 'm.fully_read') {
                        this.historyRead = true;
                    }

                    if (this.historyRead && data.event.type === 'm.room.message') {
                        let event = data.event;
                        log.debug('MATRIX [MatrixService::Service:event]: Debug', {
                            event_type: data.event.type,
                            event_data: event
                        });

                        let matrixMessage = JSON.parse(event.content.body);

                        if (matrixMessage.direction === 'in') {
                            let headers = {
                                'destination': process.env.ACTIVE_MQ_IN_QUEUE,
                                'priority': 0,
                                'body': event.content.body,
                                'persistent': 'true',
                                'expires': 0
                            };
                            log.debug('MATRIX [MatrixService::Service:event]: Debug', {
                                debug_msg: 'Sending message to MQ',
                                debug_data: headers
                            });
                            this.stompClient.send(headers, false);
                        }

                        if (matrixMessage.direction === 'out') {
                            let msg = JSON.parse(event.content.body);
                            let userName = this.matrixUserId(`client${msg.client_id}`);
                            let sb = this.clients.find(item => { return item.userName === userName; });
                            log.debug('MATRIX [MatrixService::Service:event]: Debug', {
                                debug_msg: 'Looking for client`s socket',
                                debug_data: sb
                            });
                            if (sb) {
                                log.debug('MATRIX [MatrixService::Service:event]: Debug', {
                                    debug_msg: 'Sending message to client by socket',
                                    debug_data: event.content.body
                                });
                                sb.socketClient.emit('message', event.content.body);
                            }
                        }
                    }
                });

                this.on('Room.timeline', (event, room, toStartOfTimeline) => {
                    // console.log('Room.timeline event', event);
                });

                resolve(response);
            }).catch(error => {
                log.warn('MATRIX [MatrixService::Service:authenticate]: Warning', {
                    stack_trace: error,
                    code: error.code
                });
                reject(error);
            });
        });
    }

    startSocket() {
        return new Promise<any>((resolve, reject) => {
            let socket = ws();
            socket.on('connection', client => {
                log.debug('SOCKET [MatrixService::Service:event]: Debug', {
                    debug_msg: 'Socket "connection" event',
                    debug_data: client.id
                });

                client.on('authenticate', event => {
                    console.log('SOCKET: AUTHENTICATE', event);
                    log.debug('SOCKET [MatrixService::Service:event]: Debug', {
                        debug_msg: 'Socket "authenticate" event',
                        debug_data: event
                    });
                    let userName = this.matrixUserId(`client${event.phoneNumber}`);

                    let sb = this.clients.find(item => { return item.userName === userName; });
                    if (!sb) {
                        this.clients.push({socketClient: client, userName: userName});
                    }

                    this.getClientDetails(event.phoneNumber).then(user => {
                        log.debug('SOCKET [MatrixService::Service:event]: Debug', {
                            debug_msg: 'Sending "authenticated" event to client',
                            debug_data: user
                        });
                        client.emit('authenticated', user);
                    });
                });

                client.on('message', message => {
                    log.debug('SOCKET [MatrixService::Service:event]: Debug', {
                        debug_msg: 'Pass client message to Matrix',
                        debug_data: message
                    });
                    this.sendMessage(message.client_id, JSON.stringify(message));
                });

                client.on('disconnect', () => {
                    log.debug('SOCKET [MatrixService::Service:event]: Debug', {
                        debug_msg: 'Socket "disconnect" event',
                        debug_data: client.id
                    });
                    let sbIndex = this.clients.findIndex(item => { return item.socketClient.id === client.id; });
                    if (sbIndex > -1) {
                        this.clients.splice(sbIndex, 1);
                    }
                });

                client.emit('connection', {});
            });
            socket.origins(process.env.SERVER_SOCKET_ORIGINS);
            socket.listen(process.env.SERVER_SOCKET_PORT);
            resolve(socket);
        });
    }

    authenticate(credentials) {
        return new Promise<any>((resolve, reject) => {
            this.matrixClient.loginWithPassword(credentials.user_name, credentials.password, (error, response) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(response);
                }
            });
        });
    }

    connectMQ(queueName: string) {
        return new Promise(resolve => {
            let headers = {
                destination: queueName,
                ack: 'client-individual',
                // 'activemq.prefetchSize': '10'
            };
            this.stompClient.subscribe(headers);
            resolve();
        });
    }

    stompConnect() {
        return new Promise(resolve => {
            this.stompClient.on('connected', () => {
                log.debug('STOMP [MatrixService::Service:event]: Debug', {
                    debug_msg: 'Stomp "connected" event'
                });
                let promises = [];
                // promises.push(this.connectMQ(process.env.ACTIVE_MQ_IN_QUEUE));
                promises.push(this.connectMQ(process.env.ACTIVE_MQ_OUT_QUEUE));
                Promise.all(promises).then(result => {
                    resolve();
                });
            });
            this.stompClient.on('disconnected', () => {
                log.debug('STOMP [MatrixService::Service:event]: Debug', {
                    debug_msg: 'Stomp "disconnected" event'
                });
            });
            this.stompClient.on('error', error => {
                log.error('STOMP [MatrixService::Service:event]: Error', {
                    stack_trace: error,
                    code: error.code
                });
            });
            this.stompClient.on('message', mqMessage => {
                log.debug('STOMP [MatrixService::Service:event]: Debug', {
                    debug_msg: 'Stomp "message" event',
                    debug_data: mqMessage
                });
                let messageList = mqMessage.body;
                for (let item of messageList) {
                    let matrixMessage = JSON.parse(item);
                    matrixMessage.mqMessageId = mqMessage.headers['message-id'];
                    log.debug('STOMP [MatrixService::Service:event]: Debug', {
                        debug_msg: 'Pass operator message to Matrix',
                        debug_data: matrixMessage
                    });
                    this.sendMessage(matrixMessage.client_id, JSON.stringify(matrixMessage));
                }
                this.stompClient.ack(mqMessage.headers['message-id']);
            });
            this.stompClient.on('receipt', receipt => {
                log.debug('STOMP [MatrixService::Service:event]: Debug', {
                    debug_msg: 'Stomp "receipt" event',
                    debug_data: receipt
                });
            });
            this.stompClient.connect();
        });
    }

    sendMessage(phoneNumber, message) {
        this.getClientDetails(phoneNumber).then(user => {
            log.debug('MATRIX [MatrixService::Service:sendMessage]: Debug', {
                debug_msg: 'Send message to client',
                debug_data: message
            });
            let content = {
                msgtype: 'm.text',
                body: message
            };
            this.matrixClient.sendMessage(user.room.roomId, content);
        });
    }

    searchUsers(search) {
        return new Promise<any>((resolve, reject) => {
            this.matrixClient._http.request((err, data) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            }, 'GET', `/admin/search_users/${this.adminName}`, {term: search, access_token: this.accessToken});
        });
    }

    register(userName) {
        return new Promise<any>((resolve, reject) => {
            this.matrixClient._http.request((nonceErr, nonceData) => {
                let password = process.env.MATRIX_DEFAULT_PASSWORD;

                let hmac = crypto
                    .createHmac('sha1', process.env.MATRIX_SECRET_KEY)
                    .update(nonceData.nonce, 'utf8')
                    .update('\x00', 'utf8')
                    .update(userName, 'utf8')
                    .update('\x00', 'utf8')
                    .update(password, 'utf8')
                    .update('\x00', 'utf8')
                    .update('notadmin', 'utf8');

                let regData = {
                    nonce: nonceData.nonce,
                    username: userName,
                    password: password,
                    admin: false,
                    mac: hmac.digest('hex')
                };

                this.matrixClient._http.request((err, data) => {
                    if (data) {
                        let newUser = {
                            userName: userName,
                            userId: data.user_id,
                            accessToken: data.access_token
                        };
                        resolve(newUser);
                    } else {
                        reject(err);
                    }
                }, 'POST', '/admin/register', {}, regData);
            }, 'GET', '/admin/register', {});
        });
    }

    authenticateClient(credentials) {
        return new Promise<any>((resolve, reject) => {
            let authData = {
                type: 'm.login.password',
                identifier: {
                    type: 'm.id.user',
                    user: credentials.userName
                },
                password: credentials.password,
                initial_device_display_name: 'Jungle Phone'
            };
            this.matrixClient._http.request((err, data) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            }, 'POST', '/login', {}, authData);
        });
    }

    getUserOrRegister(clientPhoneNumber) {
        return new Promise<any>((resolve, reject) => {
            let userName = `client${clientPhoneNumber}`;
            let userId = this.matrixUserId(userName);
            this.getUser(userId).then(users => {
                log.debug('MATRIX [MatrixService::Service:getUser]: Debug', {
                    debug_msg: `Looking for a client by user_id: ${userId}`,
                    debug_data: {user: users}
                });
                if (users.length > 0) {
                    let credentials = {
                        userName: userName,
                        password: process.env.MATRIX_DEFAULT_PASSWORD
                    };
                    this.authenticateClient(credentials).then(response => {
                        let userData = {
                            userName: userName,
                            accessToken: response['access_token'],
                            userId: response['user_id']
                        };
                        log.debug('MATRIX [MatrixService::Service:authenticateClient]: Debug', {
                            debug_msg: `Client successfully authenticatad`,
                            debug_data: userData
                        });
                        resolve(userData);
                    }).catch(error => {
                        log.error('MATRIX [MatrixService::Service:authenticateClient]: Error', {
                            stack_trace: error,
                            code: error.code
                        });
                        reject(error);
                    });
                } else {
                    this.register(userName).then(newUser => {
                        log.debug('MATRIX [MatrixService::Service:authenticateClient]: Debug', {
                            debug_msg: `Client successfully registered`,
                            debug_data: newUser
                        });
                        resolve(newUser);
                    }).catch(error => {
                        log.error('MATRIX [MatrixService::Service:register]: Error', {
                            stack_trace: error,
                            code: error.code
                        });
                        reject(error);
                    });
                }
            }).catch(error => {
                log.error('MATRIX [MatrixService::Service:getUser]: Error', {
                    stack_trace: error,
                    code: error.code
                });
                reject(error);
            });
        });
    }

    createRoom(roomAlias) {
        return new Promise<any>((resolve, reject) => {
            let options = {
                room_alias_name: roomAlias,
                visibility: 'public',
                invite: [],
                name: roomAlias,
                topic: 'vsk_chat'
            };
            this.matrixClient._http.request((err, data) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            }, 'POST', '/createRoom', {access_token: this.accessToken}, options);
        });
    }

    getRoomOrCreate(roomAlias) {
        return new Promise<any>((resolve, reject) => {
            let roomAliasId = this.matrixRoomAlias(roomAlias);
            this.matrixClient.getRoomIdForAlias(roomAliasId, (err, data) => {
                if (err) {
                    log.debug('MATRIX [MatrixService::Service:getRoomIdForAlias]: Debug', {
                        debug_msg: `Looking for a room by alias: ${roomAliasId}`,
                        debug_data: err
                    });
                    if (err.errcode === 'M_NOT_FOUND') {
                        this.createRoom(roomAlias).then(room => {
                            log.debug('MATRIX [MatrixService::Service:createRoom]: Debug', {
                                debug_msg: `Room successfully created: ${roomAliasId}`,
                                debug_data: room
                            });
                            resolve({roomId: room.room_id, roomAlias, roomAliasId});
                        }).catch(error => {
                            log.error('MATRIX [MatrixService::Service:createRoom]: Error', {
                                stack_trace: error,
                                code: error.code
                            });
                            reject(error);
                        });
                    } else {
                        log.error('MATRIX [MatrixService::Service:getRoomIdForAlias]: Error', {
                            stack_trace: err,
                            code: err.code
                        });
                        reject(err);
                    }
                } else {
                    log.debug('MATRIX [MatrixService::Service:getRoomIdForAlias]: Debug', {
                        debug_msg: `Room found by alias: ${roomAliasId}`,
                        debug_data: data
                    });
                    resolve({roomId: data.room_id, roomAlias, roomAliasId});
                }
            });
        });
    }

    invite(user, roomId) {
        return new Promise<any>((resolve, reject) => {
            this.matrixClient._http.request((err, data) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            }, 'POST', `/rooms/${encodeURIComponent(roomId)}/invite`, {access_token: this.accessToken}, {user_id: user.userId});
        });
    }

    join(user, roomId) {
        return new Promise<any>((resolve, reject) => {
            this.matrixClient._http.request((err, data) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            }, 'POST', `/rooms/${encodeURIComponent(roomId)}/join`, {access_token: user.accessToken}, {user_id: user.userId});
        });
    }

    isUserJoinedRoom(user, roomId) {
        return new Promise<any>((resolve, reject) => {
            this.matrixClient._http.request((err, data) => {
                if (err) {
                    reject(err);
                } else {
                    let isJoined = data.joined_rooms.includes(roomId);
                    resolve(isJoined);
                }
            }, 'GET', `/joined_rooms`, {access_token: user.accessToken});
        });
    }

    getClientDetails(clientPhoneNumber) {
        return new Promise<any>((resolve, reject) => {
            this.getUserOrRegister(clientPhoneNumber).then(user => {
                let roomAlias = `room${clientPhoneNumber}`;
                this.getRoomOrCreate(roomAlias).then(room => {
                    user.room = room;
                    this.isUserJoinedRoom(user, room.roomId).then(isJoined => {
                        if (isJoined) {
                            resolve(user);
                        } else {
                            this.invite(user, room.roomId).then(inviteData => {
                                log.debug('MATRIX [MatrixService::Service:invite]: Debug', {
                                    debug_msg: `User successfully invited`,
                                    debug_data: inviteData
                                });
                                this.join(user, room.roomId).then(joinData => {
                                    log.debug('MATRIX [MatrixService::Service:join]: Debug', {
                                        debug_msg: `User successfully joined`,
                                        debug_data: joinData
                                    });
                                    resolve(user);
                                }).catch(error => {
                                    log.error('MATRIX [MatrixService::Service:join]: Error', {
                                        stack_trace: error,
                                        code: error.code
                                    });
                                    reject(error);
                                });
                            }).catch(error => {
                                log.error('MATRIX [MatrixService::Service:invite]: Error', {
                                    stack_trace: error,
                                    code: error.code
                                });
                                reject(error);
                            });
                        }
                    }).catch(error => {
                        log.error('MATRIX [MatrixService::Service:isUserJoinedRoom]: Error', {
                            stack_trace: error,
                            code: error.code
                        });
                        reject(error);
                    });
                }).catch(error => {
                    log.error('MATRIX [MatrixService::Service:getRoomOrCreate]: Error', {
                        stack_trace: error,
                        code: error.code
                    });
                    reject(error);
                });
            }).catch(error => {
                log.error('MATRIX [MatrixService::Service:getUserOrRegister]: Error', {
                    stack_trace: error,
                    code: error.code
                });
                reject(error);
            });
        });
    }

    getUser(userId) {
        return new Promise<any>((resolve, reject) => {
            this.searchUsers(userId).then(userList => {
                resolve(userList);
            }).catch(error => {
                log.error('MATRIX [MatrixService::Service:searchUsers]: Error', {
                    stack_trace: error,
                    code: error.code
                });
                reject(error);
            });
        });
    }

    userDisplayedName(userName) {
        return userName.substring(1, userName.indexOf(':'));
    }

    matrixUserId(userName) {
        return `@${userName}:${process.env.MATRIX_DOMAIN}`;
    }

    matrixRoomAlias(roomAlias) {
        return `#${roomAlias}:${process.env.MATRIX_DOMAIN}`;
    }

    matrixRoomId(roomName) {
        return `!${roomName}:${process.env.MATRIX_DOMAIN}`;
    }

    on(event, callback) {
        log.debug('MATRIX [MatrixService::Service:join]: Debug', {
            debug_msg: `Subscribing to matrix event`,
            debug_data: event
        });
        this.matrixClient.on(event, callback);
    }

    getRooms(callback) {
        let rooms = this.matrixClient.getRooms();
        callback(rooms);
    }

}

let matrixServiceInstance = null;

export function matrixService() {
    if (!matrixServiceInstance) {
        matrixServiceInstance = new MatrixService();
    }
    return matrixServiceInstance;
}

