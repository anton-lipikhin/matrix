import * as sdk from 'matrix-js-sdk';
import * as ws from 'socket.io';
import * as Stomp from 'node-stomp';
import * as crypto from 'crypto';
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
                        console.log('MATRIX USER LIST', userList);
                    }).catch(error => {
                        console.error('MATRIX USER LIST ERROR', error);
                    });
                    this.startSocket().then(socket => {
                        this.socket = socket;
                        console.log('MATRIX USER AUTH', response);
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
                    console.log('matrixService.event', data.event.type);

                    if (data.event.type === 'm.fully_read') {
                        this.historyRead = true;
                    }

                    if (this.historyRead && data.event.type === 'm.room.message') {
                        let event = data.event;
                        console.log('MESSAGE', event);

                        let matrixMessage = JSON.parse(event.content.body);

                        if (matrixMessage.direction === 'in') {
                            let headers = {
                                'destination': process.env.ACTIVE_MQ_IN_QUEUE,
                                'priority': 0,
                                'body': event.content.body,
                                'persistent': 'true',
                                'expires': 0
                            };
                            console.log('SEND MESSAGE TO MQ', headers);
                            this.stompClient.send(headers, false);
                        }

                        if (matrixMessage.direction === 'out') {
                            let msg = JSON.parse(event.content.body);
                            let userName = this.matrixUserId(`client${msg.client_id}`);
                            let sb = this.clients.find(item => { return item.userName === userName; });
                            console.log('SUBSCRIBER clients', this.clients);
                            console.log('SUBSCRIBER userName', userName);
                            console.log('SUBSCRIBER socket', sb);
                            if (sb) {
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
                console.log('AUTH ERROR', error);
                reject(error);
            });
        });
    }

    startSocket() {
        return new Promise<any>((resolve, reject) => {
            let socket = ws();
            socket.on('connection', client => {
                console.log('SOCKET: CONNECTED', client.id);

                client.on('authenticate', e => {
                    console.log('SOCKET: AUTHENTICATE', e);
                    let userName = this.matrixUserId(`client${e.phoneNumber}`);

                    let sb = this.clients.find(item => { return item.userName === userName; });
                    if (!sb) {
                        this.clients.push({socketClient: client, userName: userName});
                    }
                    console.log('CLIENTS:', this.clients);

                    this.getClientDetails(e.phoneNumber).then(user => {
                        //console.log('SOCKET: AUTHENTICATED', user);
                        client.emit('authenticated', user);
                    });
                });

                client.on('message', message => {
                    console.log('WEB MESSAGE', message);
                    // let matrixMessage = JSON.parse(message);
                    // matrixMessage.mqMessageId = mqMessage.headers['message-id'];
                    this.sendMessage(message.client_id, JSON.stringify(message));
                });

                client.on('disconnect', () => {
                    console.log('SOCKET: DISCONNECTED', client.id);
                    let sbIndex = this.clients.findIndex(item => { return item.socketClient.id === client.id; });
                    if (sbIndex > -1) {
                        this.clients.splice(sbIndex, 1);
                    }
                    console.log('CLIENTS:', this.clients.length);
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
                console.log('STOMP: CONNECTED');
                let promises = [];
                // promises.push(this.connectMQ(process.env.ACTIVE_MQ_IN_QUEUE));
                promises.push(this.connectMQ(process.env.ACTIVE_MQ_OUT_QUEUE));
                Promise.all(promises).then(result => {
                    resolve();
                });
            });
            this.stompClient.on('disconnected', () => {
                console.log('STOMP: DISCONNECTED');
            });
            this.stompClient.on('error', e => {
                console.log('STOMP: ERROR', e);
            });
            this.stompClient.on('message', mqMessage => {
                console.log('MQ MESSAGE', mqMessage);
                let messageList = mqMessage.body;
                for (let item of messageList) {
                    let matrixMessage = JSON.parse(item);
                    matrixMessage.mqMessageId = mqMessage.headers['message-id'];
                    this.sendMessage(matrixMessage.client_id, JSON.stringify(matrixMessage));
                }
                this.stompClient.ack(mqMessage.headers['message-id']);
            });
            this.stompClient.on('receipt', receipt => {
                console.log('[AMQ] RECEIPT:', receipt);
            });
            this.stompClient.connect();
        });
    }

    sendMessage(phoneNumber, message) {
        this.getClientDetails(phoneNumber).then(user => {
            //let roomId = '!wzjyidcrNmrgkzSfcT:example.com'; // this.getRoomByUser();
            console.log('MATRIX sendMessage user', user);
            console.log('MATRIX sendMessage message', message);
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
                // console.log('USER REGISTER NONCE', nonceErr, nonceData);
                let password = process.env.MATRIX_DEFAULT_PASSWORD; // `P${userName}`;

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

                console.log('DETAILS REG regData', regData);
                this.matrixClient._http.request((err, data) => {
                    console.log('USER REGISTER ERROR', err);
                    console.log('USER REGISTER DATA', data);

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
            console.log('authenticateClient authData', authData);
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
            console.log('DETAILS userId', userId);
            this.getUser(userId).then(users => {
                console.log('DETAILS USER', users);
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
                        resolve(userData);
                    }).catch(error => {
                        console.error('AUTHENTICATE USER ERROR', error);
                        reject(error);
                    });
                } else {
                    this.register(userName).then(newUser => {
                        resolve(newUser);
                    }).catch(error => {
                        console.error('REGISTER NEW USER ERROR', error);
                        reject(error);
                    });
                }
            }).catch(error => {
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
            console.log('createRoom options', options);
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
                console.log('getRoomIdForAlias ERROR', err);
                console.log('getRoomIdForAlias ROOM', data);
                if (err) {
                    if (err.errcode === 'M_NOT_FOUND') {
                        this.createRoom(roomAlias).then(room => {
                            console.log('CREATE ROOM', room);
                            resolve({roomId: room.room_id, roomAlias, roomAliasId});
                        }).catch(error => {
                            reject(error);
                        });
                    } else {
                        reject(err);
                    }
                } else {
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
                console.log('getUserOrRegister USER', user);
                let roomAlias = `room${clientPhoneNumber}`;
                this.getRoomOrCreate(roomAlias).then(room => {
                    user.room = room;
                    this.isUserJoinedRoom(user, room.roomId).then(isJoined => {
                        console.log('isUserJoinedRoom', isJoined);
                        if (isJoined) {
                            resolve(user);
                        } else {
                            this.invite(user, room.roomId).then(inviteData => {
                                console.log('getUserOrRegister INVITE', inviteData);
                                this.join(user, room.roomId).then(joinData => {
                                    console.log('getUserOrRegister JOIN', joinData);
                                    resolve(user);
                                }).catch(error => {
                                    reject(error);
                                });
                            });
                        }
                    }).catch(error => {
                        reject(error);
                    });
                }).catch(error => {
                    reject(error);
                });
            }).catch(error => {
                reject(error);
            });
        });
    }

    getUser(userId) {
        return new Promise<any>((resolve, reject) => {
            this.searchUsers(userId).then(userList => {
                resolve(userList);
            }).catch(error => {
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
        console.log('EVENT SUBSCRIPTION', event);
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
        console.log('CREATE MATRIX SERVICE');
        matrixServiceInstance = new MatrixService();
    }
    return matrixServiceInstance;
}

