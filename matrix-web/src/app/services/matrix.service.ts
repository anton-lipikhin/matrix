import { Injectable } from '@angular/core';
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs/Observable";
import { Socket } from 'ngx-socket-io';

@Injectable({
    providedIn: 'root'
})
export class MatrixService {
    private url = 'https://matrix.altyn-i.kz/_matrix/client/r0';

    constructor(private http: HttpClient, private socket: Socket) {}

    authenticate(credentials): Observable<any> {
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
