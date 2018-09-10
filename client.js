var name;
var connectedUser;

// var HOST = location.origin.replace(/^http/, "ws");
var HOST = "wss://104.248.60.129:8443";
var connection = new WebSocket(HOST);

var loginPage = document.querySelector('#login-page'),
		usernameInput = document.querySelector('#username'),
		loginButton = document.querySelector('#login'),
		callPage = document.querySelector('#call-page'),

		remoteUsernameInput = document.querySelector('#remote-username'),

		callButton = document.querySelector('#call'),
		hangUpButton = document.querySelector('#hang-up');

callPage.style.display = "none";

// Login when the user clicks the button
loginButton.addEventListener("click", function(event) {
	console.log("Login button clicked");

	name = usernameInput.value;

	if(name.length > 0) {
		send({
			type: "login",
			name: name
		});
	}
});

connection.onopen = function() {
	console.log("Connected");
};

// Handle all messagess through this callback
connection.onmessage = function(message) {
	console.log("Got message", message.data);

	var data = JSON.parse(message.data);

	switch(data.type) {
		case "login":
			onLogin(data.success);
			break;
		case "offer":
			onOffer(data.offer, data.name);
			break;
		case "answer":
			onAnswer(data.answer);
			break;
		case "candidate":
			onCandidate(data.candidate);
			break;
		case "leave":
			onLeave();
			break;
		case "callRequest":
			onCallRequest(data.name);
			break;
		case "callResponse":
			onCallResponse(data.accepted, data.name);
			break;
		default:
			break;
	}
};

connection.onerror = function(err) {
	console.log("Got error", err);
};

// Alias for sending messages in JSON format
// Attaches other user's ID to message and encodes
function send(message) {
	if(connectedUser) {
		message.name = connectedUser;
	}
	connection.send(JSON.stringify(message));
};

function onLogin(success) {
	console.log("Login successful");
	if(success === false) {
		alert("Login unsuccessful, please try a different name.");
	} else {
		loginPage.style.display = "none";
		callPage.style.display = "block";
		//document.querySelector("#logged-in-as").innerHTML = data.name;
		// Get ready for a call
		startConnection();
	}
};

var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');
var localConnection;
// var connectedUser;
var stream;

function hasUserMedia() {
	console.log("Checking if browser supports getUserMedia()");
  navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
  return !!navigator.getUserMedia;
}

function hasRTCPeerConnection() {
	console.log("Checking for valid hasRTCPeerConnection");
  window.RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection;
  window.RTCSessionDescription = window.RTCSessionDescription || window.webkitRTCSessionDescription || window.mozRTCSessionDescription;
  window.RTCIceCandidate = window.RTCIceCandidate || window.webkitRTCIceCandidate || window.mozRTCIceCandidate;
  return !!window.RTCPeerConnection;
}


//////////////////////////////////////////////////////////////


var videoDeviceSelect = document.querySelector("#video-devices");
var audioDeviceSelect = document.querySelector("#audio-devices");
var audioInputs = new Array();
var videoInputs = new Array();

var getDevices = navigator.mediaDevices.enumerateDevices()
.then(function(devices) {
	for(var i=0; i<devices.length; i++) {
		// console.log(devices[i].kind + ": " + devices[i].label + " id = " + devices[i].deviceId);
		if(devices[i].kind === "audioinput") {
			audioInputs.push(devices[i]);
		}
		if(devices[i].kind === "videoinput") {
			videoInputs.push(devices[i]);
		}
	}
});

function buildDropdowns() {
	getDevices.then(function(){
		for(var i=0; i<audioInputs.length; i++) {
			audioDeviceSelect.add(new Option(audioInputs[i].label));
			audioDeviceSelect.options[i].value = audioInputs[i].deviceId;
		}
		for(var j=0; j<videoInputs.length; j++) {
			videoDeviceSelect.add(new Option(videoInputs[j].label));
			videoDeviceSelect.options[j].value = videoInputs[j].deviceId;
		}
	});
	return getDevices;
}

var constraints;

function setConstraints() {
	buildDropdowns().then(function() {
		constraints = {
			audio: {
				exact: {
					sourceId: audioDeviceSelect.value
				}
			},
			video: {
				width: {max: 480},
				height: {max: 360},
				exact: {
					sourceId: videoDeviceSelect.value
				}
			}
		}
	})
	return getDevices;
};

function setupLocalStream() {
	setConstraints().then(function() {
		navigator.getUserMedia(constraints, function(myStream) {
			stream = myStream;
			localVideo.src = window.URL.createObjectURL(stream);


			if(hasRTCPeerConnection()) {
				setupPeerConnection(stream);
			} else {
				alert("Sorry, your browser does not support WebRTC.");
			}
		}, function(error) {
			console.log(error);
		});
	})
	.then(function() { console.log(constraints); })
	.catch(function(err) { console.log(err.name); });
}



audioDeviceSelect.onchange = function() {
	constraints.audio.exact.sourceId = audioDeviceSelect.value;
	setupLocalStream();
}

videoDeviceSelect.onchange = function() {
	constraints.video.exact.sourceId = videoDeviceSelect.value;
	setupLocalStream();
}


// setupLocalStream();

function startConnection() {
	console.log("startConnection() triggered");
	if(hasUserMedia()) {
		setupLocalStream();

	} else {
		alert("Sorry, your browser does not support WebRTC.");
	}
}


///////////////////////////////////////////////////////////////////////////////////

///////////////////////////////////////////////////////////////////////////////////
var userList = document.querySelector("#user-list ul");



// function displayUsers() {
// 	for(var i=0; i<connection.users.length; i++)
// }



////////////////////////////////////////////////////////////////////////////////////


function setupPeerConnection(stream) {
	console.log("setupPeerConnection() triggered");

	var configuration = {
		"iceServers": [{ "url": "stun:stun.1.google.com:19302" }]
	};

	localConnection = new RTCPeerConnection(configuration);
	console.log("RTCPeerConnection object created");
	// Setup stream listening
	localConnection.addStream(stream);
	console.log("setupPeerConnection() has added the local stream to the RTCPeerConnection object")
	localConnection.onaddstream = function(remoteConnected) {
		remoteVideo.src = window.URL.createObjectURL(remoteConnected.stream);
		console.log("setupPeerConnection() has created a space for the remote stream");
	};
	// Setup ice handling
	localConnection.onicecandidate = function(event) {
		console.log("this is the localConnection.onicecandidate() function");
		if(event.candidate) {
			send({
				type: "candidate",
				candidate: event.candidate
			});
		}
	};
}


callButton.addEventListener("click", function() {
	console.log("Call button clicked");
	var remoteUsername = remoteUsernameInput.value;
	if(remoteUsername.length>0) {
		//startPeerConnection(remoteUsername);
		sendCallRequest(remoteUsername);
	}
});

////////////////////////////////////////////////////////////////

function sendCallRequest(user) {
	console.log("Sending call request");
	connectedUser = user;
	send({ type: "callRequest" });
}

function onCallRequest(name) {
	console.log("Call request received");
	connectedUser = name;
	var callResponse = window.confirm("Incoming call from " + connectedUser + ": " + "Accept or Reject?");
	send({ type: "callResponse", accepted: callResponse});
}

function onCallResponse(accepted, name) {
	console.log("Call response received");
	connectedUser = name;
	console.log(connectedUser);
	if(accepted) {
		startPeerConnection(name);
	} else {
		window.alert("Call rejected");
	}
}
////////////////////////////////////////////////////////////////


function startPeerConnection(user) {
	console.log("startPeerConnection() triggered");

	connectedUser = user;

	// Begin the offer
	localConnection.createOffer(function(offer) {
		send({ type: "offer", offer: offer });
		localConnection.setLocalDescription(offer);
		console.log("Caller's Local Description set");
	}, function(error) {
		alert("An error has occurred.");
	});
};


function onOffer(offer, name) {
	console.log("Offer received / ( onOffer() )");

	connectedUser = name;

	localConnection.setRemoteDescription(new RTCSessionDescription(offer));
	console.log("Remote Description set");
	localConnection.createAnswer(function(answer) {
		localConnection.setLocalDescription(answer);
		console.log("Callee's Local Description set");
		send({ type: "answer", answer: answer});
	}, function(error) {
		alert("An error has occurred");
	});
};

function onAnswer(answer) {
	console.log("Answer received");
	localConnection.setRemoteDescription(new RTCSessionDescription(answer));
	console.log("Remote Description set");
};


function onCandidate(candidate) {
	console.log("Candidate received");
	localConnection.addIceCandidate(new RTCIceCandidate(candidate));
};


hangUpButton.addEventListener("click", function() {
	send({ type: "leave" });
	onLeave();
});

function onLeave() {
	connectedUser = null;
	remoteVideo.src = null;
	localConnection.close();
	localConnection.onicecandidate = null;
	localConnection.onaddstream = null;
	setupPeerConnection(stream);
};
