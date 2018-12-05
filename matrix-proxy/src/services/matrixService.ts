import * as sdk from 'matrix-js-sdk';
import * as ws from 'socket.io';
// import {MatrixLogin} from '../models/matrix';

/*export class ConnectionManager {

    private static instance: ConnectionManager;
    socket: ws;
    clients: any[] = [];

    constructor() {
        console.log('SOCKET: INIT');
        this.socket = ws();
        this.socket.on('connection', (client) => {
            // console.log('SOCKET: CONNECTED', client.id)
            this.clients.push(client);

            client.on('event', (data) => {
                // console.log('SOCKET: EVENT data', data.data)
            });

            client.on('disconnect', () => {
                // console.log('SOCKET: DISCONNECTED')
            });

            client.emit('connection', {});
        });

        this.socket.origins('http://localhost:3001');

        this.socket.listen(3010);
    }

    static getInstance() {
        if (!ConnectionManager.instance) {
            ConnectionManager.instance = new ConnectionManager();
        }
        return ConnectionManager.instance;
    }

}*/

export class MatrixService {

    client: any;

    constructor() {
        this.client = sdk.createClient('https://matrix.altyn-i.kz');
    }

    authenticate(credentials) {
        return new Promise((resolve, reject) => {
            this.client.loginWithPassword(credentials.user_name, credentials.password, (error, response) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(response);
                }
            });
        });
    }

    async startClient(callback) {
        await this.client.startClient();
        callback();
    }

    getUser(userId) {
        return this.client.getUser(userId);
    }

    on(event, callback) {
        console.log('EVENT SUBSCRIPTION', event);
        this.client.on(event, callback);
    }

    createRoom(callback) {
        let options = {
            room_alias_name: 'Test_Room3',
            visibility: 'public',
            invite: ['@matrix_user:example.com', '@alipikhin:example.com', '@admin:example.com'],
            name: 'test_room',
            topic: 'test_topic'
        };
        this.client.createRoom(options, callback);
    }

    publicRooms(callback) {
        let options = {
            server: 'example.com'
        };
        this.client.publicRooms(options, callback);
    }

    getRooms(callback) {
        let rooms = this.client.getRooms();
        callback(rooms);
    }

    /* !!! It doesn't work !!!
    getRoom(roomId) {
        return this.client.getRoom(roomId);
    }*/

}


export function initMatrix() {
    let clients: any[] = [];
    const matrixService = new MatrixService();
    matrixService.startClient(() => {
        let socket = ws();
        socket.on('connection', (client) => {
            console.log('SOCKET: CONNECTED', client.id);
            clients.push(client);

            client.on('event', (data) => {
                console.log('SOCKET: EVENT data', data.data);
            });

            client.on('disconnect', () => {
                // console.log('SOCKET: DISCONNECTED');
            });

            client.on('message', (data) => {
                console.log('MESSAGE', data);
                // let user = matrixService.getUser(data);
                // client.emit('message', user);

                /*matrixService.publicRooms((err, response) => {
                    console.log('Public Rooms', response);
                    client.emit('message', JSON.stringify(response));
                });*/
            });

            client.on('getRooms', () => {
                console.log('MESSAGE getRooms');
                /*matrixService.getRooms((err, response) => {
                    console.log('getRooms response', response);
                    client.emit('message', JSON.stringify(response));
                });*/
            });

            let credentials = {
                user_name: '@matrix_user:example.com',
                password: '123qweQWE'
            };

            matrixService.authenticate(credentials).then(response => {
                // matrixService.on('deleteRoom', (roomId) => {})
                matrixService.on('event', function(data) {
                    console.log('matrixService.event', data.event.type);
                    if (data.event.type === 'm.room.message') {
                        console.log('MESSAGE', data.event);
                    }
                });

                matrixService.on('Room.timeline', (event, room, toStartOfTimeline) => {
                    //console.log('Room.timeline event', event);
                    //console.log('Room.timeline room', room);
                    //console.log('Room.timeline toStartOfTimeline', toStartOfTimeline);
                });

                /* !!! Not working
                matrixService.on('m.room.message', (event, room, toStartOfTimeline) => {
                    console.log('m.room.message', event, room, toStartOfTimeline);
                });*/
            }).catch(error => {
                console.log('AUTH ERROR', error);
            });


            client.emit('connection', {});
        });
        socket.origins('http://localhost:3001 http://localhost:4200');
        socket.listen(3010);
    });
}

