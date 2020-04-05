// Heavily borrowed from https://www.dmcinfo.com/latest-thinking/blog/id/9852/multi-user-video-chat-with-webrtc
export const WebRTC = (id, displayName, onPeersChanged, onSuccessfulJoin) => {
    var localSid = id;
    var localDisplayName = displayName;
    var roomId;
    var localStream;
    var serverConnection;
    var peerConnections = {}; // key is sid, values are peer connection object and user defined display name string
    var a_volume = -0.3; // Negative number, closer it is to zero the further away you can hear them. -5 is pretty dramatically restrictive
    var a_frequency = -1.0;
    var audioContext = new AudioContext();

    var peerConnectionConfig = {
        'iceServers': [
            { 'urls': 'stun:d-mhh-main-38:3478' }
        ]
    };

    const ToggleMyVideoStream = () => {
        console.log("ToggleMyVideoStream");
        if (!localStream) {
            connectMyVideoStream();
        }
        else {
            internalToggleVideoStream();
        }
    }

    // NB: This should only be done once
    const SetUpSockets = (socket) => {
        console.log("SetUpSockets");
        serverConnection = socket;

        serverConnection.on('joined', (data) => {
            onJoinedRoom(data);
        });

        serverConnection.on('full', (data) => {
            onRoomIsFull(data);
        });

        serverConnection.on('new_user', (data) => {
            onNewUserJoined(data);
        });

        serverConnection.on('welcome', (data) => {
            onWelcomeNewUser(data);
        });

        serverConnection.on('ice', (data) => {
            onIceMessageFromServer(data);
        });

        serverConnection.on('sdp', (data) => {
            onSdpMessageFromServer(data);
        });

        serverConnection.on('bye', (sid) => {
            onPeerHangup(sid);
        });
    }

    const JoinRoom = (roomName, displayName) => {
        console.log("JoinRoom");

        localDisplayName = displayName;

        // If we're already in this room, do nothing
        if (roomId && roomId == roomName) {
            return;
        }

        // If we're already in a different room, leave it
        if (roomId) {
            serverConnection.emit('exit_room', { room: roomId });
        }

        // Now request to join the room
        serverConnection.emit('join', { displayName: localDisplayName, sourceSid: localSid, room: roomName });
    }

    /**
     * Updates the volume and frequency of the audio effects
     * @param {array} positions An array of objects with x, y, and id
     * @param {string} localPlayerId The peerId of the player associated with this code context
     */
    const UpdateGain = (positions, localPlayerId) => {
        var myPosition = positions.find(pos => pos.id == localPlayerId);

        positions.forEach(pos => {
            // Skip ourselves - we don't get our own audio :)
            // This is called at an interval from App.js, so it could be called after a player is created but hasn't been through the webRTC handshake
            // so in that case, skip them
            if (pos.id == localPlayerId || !(pos.id in peerConnections)) {
                return;
            }

            var distance = Math.sqrt(Math.pow((myPosition.x - pos.x), 2) + Math.pow((myPosition.y - pos.y), 2));
            var volumeFromDistance = Math.pow(Math.E, a_volume * distance);
            var filterFrequencyFromDistance = Math.pow(Math.E, a_frequency * distance) * 10000; // https://www.behindthemixer.com/eight-tips-for-improving-clarity-in-speech/

            peerConnections[pos.id].gainNode.gain.value = volumeFromDistance;
            peerConnections[pos.id].filterNode.frequency.value = filterFrequencyFromDistance;
        });
    }

    function connectMyVideoStream() {
        console.log("connectMyVideoStream");

        // We'd ideally be using max values in the video constraints, but with the polyfill
        // Firefox can't hit a max of 320 - it seems to be returning around 360px wide
        // So switch to ideal for now
        var constraints = {
            video: {
                width: { ideal: 320 },
                height: { ideal: 240 },
                frameRate: { max: 30 },
            },
            audio: true,
        };

        // set up local video stream
        if (navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia(constraints)
                .then(stream => {
                    localStream = stream;

                    // If we already have peers, let's go ahead and send them our stream
                    Object.keys(peerConnections).map(peerSid => {
                        peerConnections[peerSid].pc.addStream(localStream);
                        peerConnections[peerSid].pc.createOffer().then(description => createdDescription(description, peerSid)).catch(errorHandler);
                    });

                    onPeersChanged(GetPeerList());
                }).catch(errorHandler)
        } else {
            alert('Your browser does not support getUserMedia API');
        }
    }

    function internalToggleVideoStream() {
        localStream.getTracks().forEach(t => t.enabled = !t.enabled);
    }

    function onJoinedRoom(roomName) {
        console.log(`You successfully joined room ${roomName}`)
        roomId = roomName;
        onSuccessfulJoin(roomName);
        onPeersChanged(GetPeerList());
    }

    function onRoomIsFull(roomId) {
        console.log(`You tried to join room ${roomId} and it's full 😭`);

        alert("I'm so sorry, the room you tried to join is full 😭 Maybe start a new room?");
    }

    function onNewUserJoined(data) {
        console.log("Hi, a new user joined");
        console.log(data);

        // set up peer connection object for a newcomer peer
        setUpPeer(data.sourceSid, data.displayName);
        serverConnection.emit('welcome', { displayName: localDisplayName, sourceSid: localSid, destSid: data.sourceSid, room: roomId });
    }

    function onWelcomeNewUser(data) {
        console.log("Welcome new user");
        console.log(data);

        // Register the peer in our list
        setUpPeer(data.sourceSid, data.displayName);

        // TODO: We should probably only do this if we have a localStream
        // Send them an offer so that we can be connected :)
        peerConnections[data.sourceSid].pc.createOffer().then(description => createdDescription(description, data.sourceSid)).catch(errorHandler);
    }

    function onSdpMessageFromServer(data) {
        console.log("SDP message");
        console.log(data);

        peerConnections[data.sourceSid].pc.setRemoteDescription(new RTCSessionDescription(data.description)).then(function () {
            // Only create answers in response to offers
            if (data.description.type == 'offer') {
                peerConnections[data.sourceSid].pc.createAnswer().then(description => createdDescription(description, data.sourceSid)).catch(errorHandler);
            }
        }).catch(errorHandler);
    }

    function onIceMessageFromServer(data) {
        console.log("ICE message");
        console.log(data);

        peerConnections[data.sourceSid].pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(errorHandler);
    }

    function onPeerHangup(sid) {
        removePeer(sid);
    }

    function setUpPeer(peerSid, displayName) {
        // Just in case we were suspended
        audioContext.resume();

        // Set up audio node
        var gainNode = audioContext.createGain();
        gainNode.gain.value = 0;
        peerConnections[peerSid] = {
            displayName,
            pc: new RTCPeerConnection(peerConnectionConfig),
            gainNode,
            filterNode,
            gotRemoteVideoStream: false,
        };

        var filterNode = audioContext.createBiquadFilter();
        filterNode.type = "lowpass";
        filterNode.Q.value = 1;
        filterNode.frequency.value = 0;

        gainNode.connect(filterNode);

        // Aiming to fix the echo-ing a bit
        var compressorNode = audioContext.createDynamicsCompressor();
        compressorNode.threshold.value = -30;
        compressorNode.knee.value = 20;
        compressorNode.ratio.value = 4;
        compressorNode.attack.value = 0.1;
        compressorNode.release.value = 0.3;

        filterNode.connect(compressorNode);
        compressorNode.connect(audioContext.destination);

        peerConnections[peerSid] = {
            'displayName': displayName,
            'pc': new RTCPeerConnection(peerConnectionConfig),
            gainNode,
            filterNode,
            'audioTrack': undefined
        };
        peerConnections[peerSid].pc.onicecandidate = event => gotIceCandidate(event, peerSid);
        peerConnections[peerSid].pc.ontrack = event => gotRemoteStream(event, peerSid);
        peerConnections[peerSid].pc.oniceconnectionstatechange = event => checkPeerDisconnect(event, peerSid);

        // It's possible we joined without video - that's okay, we'll connect it up later!
        if (localStream) {
            peerConnections[peerSid].pc.addStream(localStream);
        }

        onPeersChanged(GetPeerList());
    }

    function gotIceCandidate(event, peerSid) {
        console.log(`got ice candidate for ${peerSid}`);
        console.log(event);
        if (event.candidate != null) {
            serverConnection.emit('ice', { candidate: event.candidate, sourceSid: localSid, destSid: peerSid, room: roomId });
        }
    }

    function createdDescription(description, peerSid) {
        console.log(`got description, peer ${peerSid}`);
        peerConnections[peerSid].pc.setLocalDescription(description).then(function () {
            serverConnection.emit('sdp', { description: peerConnections[peerSid].pc.localDescription, sourceSid: localSid, destSid: peerSid, room: roomId });
        }).catch(errorHandler);
    }

    function gotRemoteStream(event, peerSid) {
        console.log(`got remote stream, peer ${peerSid}`);

        // It seems like when we request audio and video we get two 'ontrack' events - one for each
        // Both have the same contents in event.streams, so it doesn't seem like it matters
        // But just in case
        if (event.track.kind == "video") {
            console.log("Event is of kind video");

            // So that we know whether to remove the video node if the peer drops out
            peerConnections[peerSid].stream = event.streams[0];
            peerConnections[peerSid].gotRemoteVideoStream = true;
            onPeersChanged(GetPeerList());
        } else if (event.track.kind == "audio") {
            console.log("Event is of kind audio");
            var audioTrack = audioContext.createMediaStreamSource(event.streams[0]);
            audioTrack.connect(peerConnections[peerSid].gainNode);
        }
    }

    function checkPeerDisconnect(event, peerSid) {
        if (!peerConnections[peerSid]) {
            console.log(`checking for peer disconnects for ${peerSid} - its obj in peerConnections is ${peerConnections[peerSid]}`);
            removePeer(peerSid);
        }
        else {
            var state = peerConnections[peerSid].pc.iceConnectionState;
            console.log(`connection with peer ${peerSid} ${state}`);
            if (state === "failed" || state === "closed" || state === "disconnected") {
                removePeer(peerSid);
            }
        }
    }

    function removePeer(peerSid) {
        console.log("deleting peer " + peerSid);
        if (peerSid in peerConnections) {
            delete peerConnections[peerSid];
        }
    }

    function errorHandler(error) {
        console.log(error);
    }

    function GetPeerList() {
        return [].concat(
            [
                {
                    id: localSid,
                    stream: localStream,
                    local: true,
                }
            ],
            Object.keys(peerConnections).map(peerId => {
                const { gotRemoteVideoStream, stream } = peerConnections[peerId];
                return {
                    id: peerId,
                    stream,
                    gotRemoteVideoStream,
                };
            })
        );
    }

    return { SetUpSockets, ToggleMyVideoStream, JoinRoom, UpdateGain };
};
