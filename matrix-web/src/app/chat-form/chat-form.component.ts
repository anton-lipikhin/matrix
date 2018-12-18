import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { MatrixService } from '../services/matrix.service';
import { StorageService } from '../services/storage.service';
import {Router} from '@angular/router';

@Component({
    selector: 'app-chat-form',
    templateUrl: './chat-form.component.html',
    styleUrls: ['./chat-form.component.css']
})
export class ChatFormComponent implements OnInit {

    messageList = [];
    operatorMessage = '';
    clientMessage = '';
    phoneNumber = '';
    user = null;
    // room_id = '!wzjyidcrNmrgkzSfcT:example.com';

    /*operatorCredentials = {
        userName: 'matrix_user',
        password: '123qweQWE',
        auth: null
    };

    clientCredentials = {
        userName: 'alipikhin',
        password: '123qweQWE',
        auth: null
    };*/
    clientCredentials = null;

    constructor(
        private matrix: MatrixService,
        private storage: StorageService,
        private router: Router
    ) { }

    model = {
        value: '',
        placeholder: '7057279816'
    }

    /*onOperatorSend() {
        console.log('MSG', this.operatorMessage);
        let msg = {
            client_id: this.operatorCredentials.userName,
            message: this.operatorMessage,
            date: new Date().getTime(),
            direction: 'out'
        };
        this.matrix.sendMessage(this.operatorCredentials, this.room_id, JSON.stringify(msg)).subscribe(data => {
            console.log('SEND operator', data);
            this.operatorMessage = '';
            this.getMessageHistory(this.operatorCredentials);
        });
    }*/

    onClientSend() {
        if(!this.phoneNumber){
            console.error('Define phoneNumber before connect');
            return;
        }
        /*let msg = {
            client_id: this.phoneNumber,
            message: this.clientMessage,
            date: new Date().getTime(),
            direction: 'in'
        };
        this.matrix.sendMessageViaSocket(this.phoneNumber, msg);
        this.clientMessage = '';*/

        let msg = {
            client_id: this.phoneNumber,
            message: this.clientMessage,
            date: new Date().getTime(),
            direction: 'in'
        };
        console.log('SEND MSG USER', this.user);
        let creds = {
            auth: {
                access_token: this.user.accessToken
            }
        };
        this.matrix.sendMessage(creds, this.user.room.roomId, JSON.stringify(msg)).subscribe(data => {
            console.log('SEND client', data);
            this.clientMessage = '';
            this.getMessageHistory(this.clientCredentials);
        });
    }

    onClientConnect() {
        if(!this.phoneNumber){
            console.error('Define phoneNumber before connect');
            return;
        }
        this.matrix.connect(this.phoneNumber).then(user => {
            console.log('USER CONNECT', user);
            this.user = user;
        }).catch(error => {
            console.error('Matrix connection failed', error);
        });
    }

    onClientDetails() {
        this.matrix.socketSend('getClientDetails', '77057279815');
    }

    onClientRooms() {
        this.matrix.getUserJoinRooms(this.clientCredentials);
    }

    getMessageHistory(credentials) {
        this.matrix.getMessageHistory(credentials, this.user.room.roomId).subscribe(data => {
            this.messageList = data.chunk.map(item => {
                let userName = item.sender.substring(1, item.sender.indexOf(':'));
                return {
                    userName: userName,
                    message: item.content.body,
                    time: item.origin_server_ts
                }
            });
        });
    }

    ngOnInit() {
        /*this.matrix.authenticate(this.operatorCredentials).subscribe(data => {
            console.log('AUTH operator', data);
            this.operatorCredentials.auth = data;
            this.getMessageHistory(this.operatorCredentials);
        });*/

        /*this.matrix.authenticate(this.clientCredentials).subscribe(data => {
            console.log('AUTH client', data);
            this.clientCredentials.auth = data;
            this.getMessageHistory(this.clientCredentials);
            this.matrix.on('message', message => {
                this.getMessageHistory(this.clientCredentials);
            });
        });*/
    }

}
