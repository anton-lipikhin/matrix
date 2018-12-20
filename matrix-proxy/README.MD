# Matrix Proxy Server

## Получение информации о клиенте:
Request:  
Method: GET  
URL: http://localhost:3000/v1/matrix/connect?phoneNumber=77057279817  
Params:  
&nbsp;&nbsp;&nbsp;&nbsp;**phoneNumber** = 77057279817  

Example:  
http://localhost:3000/v1/matrix/connect?phoneNumber=77057279817  

Response:  
{"userName": "client77057279817", "accessToken": "MDAxOWxvY2F0aW9uIGV4YW ... ", "userId": "@client77057279817:example.com", "room": {"roomId": "!rcoefiJcRBYuUZYbVk:example.com", "roomAlias": "room77057279817", "roomAliasId": "#room77057279817:example.com"}}

Error:  
{"success": false, "error": {"fields": {"phoneNumber": {"message": "Query parameter \"phoneNumber\" is required"}}, "message": "Bad request", "status": 400, "name": "ValidateError"}, "data": null, "pageCount": 0}  

## Подключение по сокету:
1. по дефолту сокет на 3010 порту, может поменяться
2. после подключения подписываемся на события:  
&nbsp;&nbsp;&nbsp;&nbsp;**"message"** - для получения сообщений от оператора;  
&nbsp;&nbsp;&nbsp;&nbsp;**"authenticated"** - признак того, что мы подключились;  
3. имитим событие "authenticate" и передаем объект типа {phoneNumber: 77057279817}, в ответ веренется "authenticated" с объектом:  
userInfo = {"userName": "client77057279817", "accessToken": "MDAxOWxvY2F0aW9uIGV4YW ... ", "userId": "@client77057279817:example.com", "room": {"roomId": "!rcoefiJcRBYuUZYbVk:example.com", "roomAlias": "room77057279817", "roomAliasId": "#room77057279817:example.com"}}

## Отправляем сообщение (REST):

sendMessage(credentials, room_id, message): Observable<any> {
	let txnId = new Date().getTime();
	let url = `${url}/rooms/${room_id}/send/m.room.message/${txnId}?access_token=${credentials.auth.access_token}`;
	return this.http.put<any>(url, JSON.stringify({msgtype: 'm.text', body: message}));
}

где:

**url** = 'https://matrix.domain.ru/_matrix/client/r0'  
**room_id** = userInfo.room.roomId  
**message** = {"client_id": "77057279817", "message": "Test msg 1", "date": 1544973354219, "direction": "in"}  
**credentials** = {
	auth: {
		access_token: 'MDAxOWxv ....' // userInfo.accessToken
	}
}

этот код есть в мсходниках matrix-web


