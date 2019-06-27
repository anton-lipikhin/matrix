import { Injectable } from '@angular/core';
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs/Observable";
import { Socket } from 'ngx-socket-io';

@Injectable({
    providedIn: 'root'
})
export class MatrixService {
    private url = 'https://matrix.some-domain.com/_matrix/client/r0';
    private subscribers = [];

    constructor(private http: HttpClient, private socket: Socket) {}

    on(event, callback) {
        if (!event || !callback) return;
        let sb = this.subscribers.find(item => { return item.event === event; });
        if (sb) {
            sb.callbackList.push(callback);
        } else {
            let callbackList = [];
            callbackList.push(callback);
            this.subscribers.push({event: event, callbackList: callbackList});
        }
    }

    emit(event, data) {
        if (!event) return;
        let sb = this.subscribers.find(item => { return item.event === event; });
        if (sb && sb.callbackList.length > 0) {
            for (let callback of sb.callbackList) {
                if (callback) callback(data);
            }
        }
    }

    socketSend(event, data) {
        this.socket.emit(event, data);
    }

    connect(phoneNumber) {
        console.log('CONNECT', phoneNumber);
        return new Promise((resolve, reject) => {
            this.socket.on('message', message => {
                console.log('MESSAGE', message);
                this.emit('message', message);
            });
            this.socket.on('authenticated', credentials => {
                resolve(credentials);
            });
            this.socket.emit('authenticate', {phoneNumber});
        });
    }

    authenticate(credentials): Observable<any> {
        this.socket.on('message', message => {
            console.log('MESSAGE', message);
            this.emit('message', message);
        });
        this.socket.emit('authenticate', credentials);

        let data = {
            "type": "m.login.password",
            "identifier": {
                "type": "m.id.user",
                "user": credentials.userName
            },
            "password": credentials.password,
            "initial_device_display_name": "Jungle Phone"
        };
        return this.http.post<any>(`${this.url}/login`, JSON.stringify(data));
    }

    sendMessageViaSocket(phoneNumber, message) {
        this.socket.emit('message', {phoneNumber, message});
    }

    sendMessage(credentials, room_id, message): Observable<any> {
        let txnId = new Date().getTime();
        let url = `${this.url}/rooms/${room_id}/send/m.room.message/${txnId}?access_token=${credentials.auth.access_token}`;
        return this.http.put<any>(url, JSON.stringify({msgtype: 'm.text', body: message}));
    }

    getMessageHistory(credentials, room_id): Observable<any> {
        let url = `${this.url}/rooms/${room_id}/messages?from=s345_678_333&dir=b&limit=20&access_token=${credentials.auth.access_token}`;
        // TODO: sort forward doesn't work !!!  dir=b => dir=f
        return this.http.get<any>(url);
    }


    getEventDetails(credentials, room_id, event_id): Observable<any> {
        let url = `${this.url}/rooms/${room_id}/event/${event_id}&access_token=${credentials.auth.access_token}`;
        return this.http.get<any>(url);
    }

    join(credentials, room_id, user_id): Observable<any> {
        let url = `${this.url}/rooms/${room_id}/join?access_token=${credentials.auth.access_token}`;
        return this.http.post<any>(url, JSON.stringify({user_id: user_id}));
    }

    invite(credentials, room_id, user_id): Observable<any> {
        let url = `${this.url}/rooms/${room_id}/invite?access_token=${credentials.auth.access_token}`;
        return this.http.post<any>(url, JSON.stringify({user_id: user_id}));
    }

    getRoomMembers(credentials, room_id): Observable<any> {
        let url = `${this.url}/rooms/${room_id}/members?access_token=${credentials.auth.access_token}`;
        return this.http.get<any>(url);
    }

    getUserJoinRooms(credentials): Observable<any> {
        let url = `${this.url}/joined_rooms?access_token=${credentials.auth.access_token}`;
        return this.http.get<any>(url);
    }

}
