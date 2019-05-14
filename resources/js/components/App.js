import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import MediaHandler from '../MediaHandler';
import Pusher from 'pusher-js';
import Peer from 'simple-peer';

const APP_KEY = '9280006e23b3880ef8e9';
export default class App extends Component {
    constructor(){
        super();
        this.state = { hasMedia:false, otherUserId:null, users:null, isLoading: null };
        this.peers = {};
        this.user = window.user;
        this.user.stream = null;
        this.mediaHandler = new MediaHandler();
        this.setupPusher();
        this.callTo = this.callTo.bind(this);
        this.setupPusher = this.setupPusher.bind(this);
        this.startPeer = this.startPeer.bind(this);
    }
    componentWillMount(){
        this.mediaHandler.getPermissions()
            .then((stream) => {
                this.setState({ hasMedia:true });
                this.user.stream = stream;
                try {
                    this.myVideo.srcObject = stream;
                } catch (error) {
                    this.myVideo.src = URL.createObjectURL(stream);    
                }
                this.myVideo.play();
            })
    }
    setupPusher(){
        //Pusher.logToConsole = true;
        this.pusher = new Pusher(APP_KEY, {
            authEndpoint: '/pusher/auth',
            cluster: 'ap2',
            auth: {
                params: this.user.id,
                headers:{
                    'X-CSRF-Token': window.csrfToken
                }
            }
        });
        this.channel = this.pusher.subscribe('presence-video-channel');
        this.channel.bind(`client-signal-${this.user.id}`, (signal) => {
            let peer = this.peers[signal.userId];
            if(peer == undefined){
                this.setState({otherUserId: signal.userId});
                peer = this.startPeer(signal.userId, false);
            }
            peer.signal(signal.data);
        });
    }
    startPeer(userId, initiator = true){
        const peer = new Peer({
            initiator,
            stream: this.user.stream,
            trickle: false
        });
        peer.on('signal', (data) => {
            this.channel.trigger(`client-signal-${userId}`, {
                type: 'signal',
                userId: this.user.id,
                data: data
            });
        });

        peer.on('stream', (stream) => {
            try {
                this.userVideo.srcObject = stream;
            } catch (e) {
                this.userVideo.src = URL.createObjectURL(stream);
            }
            this.userVideo.play();
        });

        peer.on('close', () => {
            let peer = this.peers[userId];
            if(peer != undefined){
                peer.destroy();
            }
            this.peers[userId] = undefined;
        });
        return peer;
    }
    callTo(userId){
        this.peers[userId] = this.startPeer(userId);
    }
    componentDidMount(){
        this.getUsers();
    }
    async getUsers() {
        if(!this.state.users){
            try {
                this.setState({ isLoading: true });
                const response = await fetch('/get/users');
                const usersList = await response.json(); 
                this.setState({ users: usersList, isLoading: false}); console.log(this.state.users);
            } catch (error) {
                this.setState({ isLoading: false });
                console.error(error); 
            }
        }
    }
    render() {
        return (
            <div className="App">
                {this.state.users &&
                    <div>
                            {this.state.users.map(
                                    user =>
                                    (this.user.id != user.id) ? <button key={user.id} onClick={()=>this.callTo(user.id)}>Call {user.name}</button> : null
                            )}
                    </div>
                }
                <div className="video-container">
                    <video className="my-video" ref={(ref) => {this.myVideo = ref;}}></video>
                    <video className="user-video" ref={(ref) => {this.userVideo = ref;}}></video>
                </div>
            </div>
        );
    }
}

if (document.getElementById('app')) {
    ReactDOM.render(<App />, document.getElementById('app'));
}
