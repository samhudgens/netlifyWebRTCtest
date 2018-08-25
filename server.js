var https = require('https');
var fs = require('fs');
var url = require('url');

var options = {
	// Use readFileSync to ensure that the key and certificate are read synchronously
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.crt')
};

var httpsServer = https.createServer(options, function(request, response) {
	var pathname = url.parse(request.url).pathname;
	console.log("Request for " + pathname + " received.");

	//the "data" parameter refers to the contents of the file
    fs.readFile(pathname.substr(1), function(err, data) {
  		if(err) {
  			console.log(err);
  			response.writeHead(404, {"Content-Type": "text/html"});
  		} else {
  			response.writeHead(200, {"Content-Type": "text/html"});
  			response.write(data.toString());
  		}
  		response.end();
  	});

}).listen(3000);





// =======================================


var WebSocketServer = require("ws").Server;
var wss = new WebSocketServer({ server: httpsServer });
var users = {};

console.log("Server running on Port 3000");

wss.on('connection', function(connection) {
	console.log("User connected");
  // console.log(wss);
	connection.on('message', function(message) {
		var data;
		// this makes our WebSocket only accept JSON messages
		try {
			data = JSON.parse(message);
		} catch (e) {
			console.log("Error parsing JSON");
			data = {};
		}
		// this code checks if a user is sending a login type of message
		// checks if username already exists, and if so, tells them to make a new one
		switch(data.type) {
			case "login": console.log("User logged in as", data.name);
			if(users[data.name]) {
				sendTo(connection, { type: "login", success: false });
			} else {
				users[data.name] = connection;
				connection.name = data.name;
				sendTo(connection, { type: "login", success: true });
			}
			break;
      case "callRequest": console.log("Sending call request to ", data.name);
        var conn = users[data.name];
        if(conn != null) {
          connection.otherName = data.name;
          sendTo(conn, { type: "callRequest", name: connection.name });
        }
        break;
      case "callResponse": console.log("Sending call response to ", data.name);
        var conn = users[data.name];
        if(conn != null) {
          connection.otherName = data.name;
          sendTo(conn, { type: "callResponse", accepted: data.accepted, name: connection.name });
        }
        break;
			case "offer": console.log("Sending offer to", data.name);
				var conn = users[data.name];
				if(conn != null) {
					connection.otherName = data.name;
					sendTo(conn, { type: "offer", name: connection.name, offer: data.offer });
				}
				break;
			case "answer": console.log("Sending answer to", data.name);
				var conn = users[data.name];
				if(conn != null) {
					connection.otherName = data.name;
					sendTo(conn, { type: "answer", answer: data.answer });
				}
				break;
			case "candidate": console.log("Sending candidate to", data.name);
				var conn = users[data.name];
				if(conn != null) {
					sendTo(conn, { type: "candidate", candidate: data.candidate });
				}
				break;
			case "leave": console.log("Disconnecting user from", data.name);
				var conn = users[data.name];
				conn.otherName = null;
				if(conn != null) {
					sendTo(conn, { type: "leave" });
				}
				break;
			default:
				sendTo(connection, { type: "error", message: "Unrecognized command: " + data.type});
				break;
		}
	});

	connection.on('close', function() {
		if(connection.name) {
			delete users[connection.name];

			if(connection.otherName) {
				console.log("Disconnecting user from", connection.otherName);
				var conn = users[connection.otherName];
				conn.otherName = null;

				if(conn != null) {
					sendTo(conn, { type: "leave" });
				}
			}
		}
	});

	//connection.send("Hello World");
});

// this method makes sure all messages are encoded in JSON format
function sendTo(conn, message) {
	conn.send(JSON.stringify(message));
}

wss.on('listening', function() {
	console.log("Server started...");
});
