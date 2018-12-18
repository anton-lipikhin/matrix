Получение информации о клиенте:
http://localhost:3000/v1/matrix/connect?phoneNumber=77057279817

Ответ:
{"userName":"client77057279817","accessToken":"MDAxOWxvY2F0aW9uIGV4YW1wbGUuY29tCjAwMTNpZGVudGlmaWVyIGtleQowMDEwY2lkIGdlbiA9IDEKMDAzMWNpZCB1c2VyX2lkID0gQGNsaWVudDc3MDU3Mjc5ODE3OmV4YW1wbGUuY29tCjAwMTZjaWQgdHlwZSA9IGFjY2VzcwowMDIxY2lkIG5vbmNlID0gJlJjd2w9bVptRk85dW5EQQowMDJmc2lnbmF0dXJlIPt0shS1qvBAr_o1EbbAjDJavKwmF_9Pdb3BqYxwgnMdCg","userId":"@client77057279817:example.com","room":{"roomId":"!rcoefiJcRBYuUZYbVk:example.com","roomAlias":"room77057279817","roomAliasId":"#room77057279817:example.com"}}

Подключение по сокету:
1. по дефолту сокет на 3010 порту, может поменяться
2. после подключения подписывается на события "message" (для получения сообщений от оператора) и "authenticated" (признак того, что мы подключились), затем имитим событие "authenticate" и передаем объект типа {phoneNumber: 77057279817}, в ответ веренется "authenticated" с объектом:
userInfo = {"userName":"client77057279817","accessToken":"MDAxOWxvY2F0aW9uIGV4YW1wbGUuY29tCjAwMTNpZGVudGlmaWVyIGtleQowMDEwY2lkIGdlbiA9IDEKMDAzMWNpZCB1c2VyX2lkID0gQGNsaWVudDc3MDU3Mjc5ODE3OmV4YW1wbGUuY29tCjAwMTZjaWQgdHlwZSA9IGFjY2VzcwowMDIxY2lkIG5vbmNlID0gJlJjd2w9bVptRk85dW5EQQowMDJmc2lnbmF0dXJlIPt0shS1qvBAr_o1EbbAjDJavKwmF_9Pdb3BqYxwgnMdCg","userId":"@client77057279817:example.com","room":{"roomId":"!rcoefiJcRBYuUZYbVk:example.com","roomAlias":"room77057279817","roomAliasId":"#room77057279817:example.com"}}

Отправляем сообщение (REST):

sendMessage(credentials, room_id, message): Observable<any> {
	let txnId = new Date().getTime();
	let url = `${url}/rooms/${room_id}/send/m.room.message/${txnId}?access_token=${credentials.auth.access_token}`;
	return this.http.put<any>(url, JSON.stringify({msgtype: 'm.text', body: message}));
}

где:

url = 'https://matrix.domain.ru/_matrix/client/r0'
room_id = userInfo.room.roomId
message = {"client_id":"77057279817","message":"Test msg 1","date":1544973354219,"direction":"in"}
credentials = {
	auth: {
		access_token: 'MDAxOWxv ....' // userInfo.accessToken
	}
}

этот код есть в мсходниках matrix-web


