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
    room_id = '!wzjyidcrNmrgkzSfcT:example.com';

    operatorCredentials = {
        userName: 'matrix_user',
        password: '123qweQWE',
        auth: null
    };

    clientCredentials = {
        userName: 'alipikhin',
        password: '123qweQWE',
        auth: null
    };

    constructor(
        private matrix: MatrixService,
        private storage: StorageService,
        private router: Router
    ) { }

    model = {
        value: '',
        placeholder: '7057279816'
    }

    onOperatorSend() {
        console.log('MSG', this.operatorMessage);
        let msg = this.operatorMessage;
        this.matrix.sendMessage(this.operatorCredentials, this.room_id, msg).subscribe(data => {
            console.log('SEND operator', data);
            this.operatorMessage = '';
            this.getMessageHistory();
        });
    }

    onClientSend() {
        console.log('MSG', this.clientMessage);
        let msg = this.clientMessage;
        this.matrix.sendMessage(this.clientCredentials, this.room_id, msg).subscribe(data => {
            console.log('SEND client', data);
            this.clientMessage = '';
            this.getMessageHistory();
        });
    }

    getMessageHistory() {
        this.matrix.getMessageHistory(this.operatorCredentials, this.room_id).subscribe(data => {
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
        this.matrix.authenticate(this.operatorCredentials).subscribe(data => {
            console.log('AUTH operator', data);
            this.operatorCredentials.auth = data;
            this.getMessageHistory();
        });

        this.matrix.authenticate(this.clientCredentials).subscribe(data => {
            console.log('AUTH client', data);
            this.clientCredentials.auth = data;
        });
    }

}
