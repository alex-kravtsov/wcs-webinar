 KmvWebinar = {
     SESSION_STATUS: Flashphoner.constants.SESSION_STATUS,
     STREAM_STATUS: Flashphoner.constants.STREAM_STATUS,
     WCS_APPLICATION_KEY: 'devApp',
     FLASH_PROVIDER_LOCATION: '/js/ph/media-provider.swf',
     WCS_AUTH_TOKEN: null,
     EVENT_ID: null,
     CHROME_EXTENSION_ID: 'your-extention-id',
     DESKTOP_SCREEN_WIDTH: 640,
     DESKTOP_SCREEN_HEIGHT: 480,
     DESKTOP_SCREEN_FPS: 30,

     session: null,
     cameraDisplay: null,
     cameraStream: null,
     desktopDisplay: null,
     desktopStream: null,
     mixStreamName: null,
     mixStreamUri: null,
     mixStream: null,
     mixDisplay: null,
     recordedMediaSessionId: null,
     startBroadcastingButton: null,
     startRecordingButton: null,
     showDesktopButton: null,

     init: function(){
         try {
             Flashphoner.init({
                 flashMediaProviderSwfLocation: this.FLASH_PROVIDER_LOCATION,
                 screenSharingExtensionId: this.CHROME_EXTENSION_ID
             });
         } catch(e) {
             console.log("Cannot init Flashphoner.");
             return;
         }
         var self = this;
         this.WCS_AUTH_TOKEN = $('meta[name="wcs-token"]').attr('value');
         this.EVENT_ID = $('meta[name="event-id"]').attr('value');
         this.cameraDisplay = document.querySelector('[data-kw-display="camera-display"]');
         this.desktopDisplay = document.querySelector('[data-kw-display="desktop-display"]');
         this.mixDisplay = document.querySelector('[data-kw-display="mix-display"]');
         this.startBroadcastingButton = document.querySelector('[data-kw-control="start-broadcasting"]');
         this.startBroadcastingButton.setAttribute('data-kw-status', 'initial');
         this.startBroadcastingButton.setAttribute('value', 'Begin Broadcasting');
         this.startBroadcastingButton.addEventListener('click', function(){
             self.onStartBroadcastingButtonClick();
         });
         this.startRecordingButton = document.querySelector('[data-kw-control="start-recording"]');
         this.startRecordingButton.setAttribute('data-kw-status', 'initial');
         this.startRecordingButton.setAttribute('disabled', 'disabled');
         this.startRecordingButton.setAttribute('value', 'Start Recording');
         this.startRecordingButton.addEventListener('click', function(){
             self.onStartRecordingButtonClick();
         });
         this.showDesktopButton = document.querySelector('[data-kw-control="show-desktop"]');
         this.showDesktopButton.setAttribute('data-kw-status', 'initial');
         this.showDesktopButton.setAttribute('disabled', 'disabled');
         this.showDesktopButton.setAttribute('value', 'Show Desktop');
         this.showDesktopButton.addEventListener('click', function(){
             self.onShowDesktopButtonClick();
         });
     },

     createSession: function(){
         var options = {
             urlServer: setURL(),
             appKey: this.WCS_APPLICATION_KEY,
             custom: {
                 token: this.WCS_AUTH_TOKEN
             }
         };
         var self = this;
         Flashphoner
             .createSession(options)
             .on(this.SESSION_STATUS.ESTABLISHED, function(session){
                 console.log("Flashphoner session established.");
                 self.session = session;
                 self.onSessionStarted();
             })
             .on(this.SESSION_STATUS.DISCONNECTED, function(){
                 console.log("Flashphoner session disconnected.");
             })
             .on(this.SESSION_STATUS.FAILED, function(){
                 console.log("Flashphoner session failed.");
             });
     },

     createCameraStream: function(){
         if (!this.session) {
             return;
         }
         if (this.cameraStream) {
             return;
         }
         var self = this;
         var webcamStreamName = createUUID(8);
         this.session
             .createStream({
                 name: webcamStreamName,
                 display: this.cameraDisplay,
                 cacheLocalResources: false,
                 receiveVideo: false,
                 receiveAudio: false
             })
             .on(this.STREAM_STATUS.PUBLISHING, function(stream){
                 self.cameraStream = stream;
                 self.onCameraStreamPublished();
             })
             .on(this.STREAM_STATUS.UNPUBLISHED, function(){
                 console.log("Outgoing webcam stream unpublished.");
             })
             .on(this.STREAM_STATUS.FAILED, function(stream){
                 console.log("Outgoing webcam stream failed.");
             })
             .publish();
     },

     createMixer: function(){
         this.mixStreamName = createUUID(8);
         this.mixStreamUri = 'mixer://mixer' + this.EVENT_ID;
         var self = this;
         axios.post('/wcs-rest-api/call-action', {
             wcs_entry: '/mixer/startup',
             wcs_query: {
                 uri: this.mixStreamUri,
                 localStreamName: this.mixStreamName
             }
         })
              .then(function (response) {
                  if (response.data.error) {
                      console.log(response.data);
                  } else if (response.data.success) {
                      self.onMixerCreated();
                  }
              })
              .catch(function (error) {
                  console.log('AXIOS ERROR: ' + error);
              });
     },

     addCameraStreamToMixer: function(){
         var self = this;
         axios.post('/wcs-rest-api/call-action', {
             wcs_entry: '/mixer/add',
             wcs_query: {
                 uri: this.mixStreamUri,
                 remoteStreamName: this.cameraStream.name()
             }
         })
              .then(function (response) {
                  if (response.data.error) {
                      console.log(response.data);
                  } else if (response.data.success) {
                      self.onCameraStreamAddedToMixer();
                  }
              })
              .catch(function (error) {
                  console.log('AXIOS ERROR: ' + error);
              });
     },

     playMixerStream: function(){
         var self = this;
         this.session.createStream({
             name: this.mixStreamName,
             display: this.mixDisplay
         })
             .on(this.STREAM_STATUS.PLAYING, function(stream){
                 self.mixStream = stream;
                 self.onMixerStreamPlaying();
             })
             .on(this.STREAM_STATUS.STOPPED, function(){
                 console.log("Incoming mix stream stopped.");
             })
             .on(this.STREAM_STATUS.FAILED, function(stream){
                 console.log("Incoming mix stream failed.");
             }).play();
     },

     createDesktopStream: function(){
         if (!this.session) {
             return;
         }
         var self = this;
         var desktopStreamName = 'desktop-' + createUUID(8);
         var constraints = {
             video: {
                 width: this.DESKTOP_SCREEN_WIDTH,
                 height: this.DESKTOP_SCREEN_HEIGHT,
                 frameRate: this.DESKTOP_SCREEN_FPS,
                 type: "screen"
             }
         };
         this.session.createStream({
             name: desktopStreamName,
             display: this.desktopDisplay,
             constraints: constraints
         })
             .on(this.STREAM_STATUS.PUBLISHING, function(stream){
                 self.desktopStream = stream;
                 self.onDesktopStreamPublished();
             })
             .on(this.STREAM_STATUS.UNPUBLISHED, function(){
                 console.log("Outgoing desktop stream unpublished.");
             })
             .on(this.STREAM_STATUS.FAILED, function(stream){
                 console.log("Outgoing desktop stream failed.");
             })
             .publish();
     },

     addDesktopStreamToMixer: function(){
         var self = this;
         axios.post('/wcs-rest-api/call-action', {
             wcs_entry: '/mixer/add',
             wcs_query: {
                 uri: this.mixStreamUri,
                 remoteStreamName: this.desktopStream.name()
             }
         })
              .then(function (response) {
                  if (response.data.error) {
                      console.log(response.data);
                  } else if (response.data.success) {
                      self.onDesktopStreamAddedToMixer();
                  }
              })
              .catch(function (error) {
                  console.log('AXIOS ERROR: ' + error);
              });
     },

     removeDesktopStreamFromMixer: function(){
         var self = this;
         axios.post('/wcs-rest-api/call-action', {
             wcs_entry: '/mixer/remove',
             wcs_query: {
                 uri: this.mixStreamUri,
                 remoteStreamName: this.desktopStream.name()
             }
         })
              .then(function (response) {
                  if (response.data.error) {
                      console.log(response.data);
                  } else if (response.data.success) {
                      self.onDesktopStreamRemovedFromMixer();
                  }
              })
              .catch(function (error) {
                  console.log('AXIOS ERROR: ' + error);
              });
     },

     beginBroadcasting: function(){
         this.createSession();
     },

     endBroadcasting: function(){
         if (!this.mixStreamUri) {
             return;
         }
         var self = this;
         axios.post('/wcs-rest-api/call-action', {
             wcs_entry: '/mixer/terminate',
             wcs_query: {
                 uri: this.mixStreamUri,
             }
         })
              .then(function (response) {
                  if (response.data.error) {
                      console.log("Error. Cannot terminate stream.");
                  } else if (response.data.success) {
                      self.onMixerTerminated();
                  }
              })
              .catch(function (error) {
                  console.log('AXIOS ERROR: ' + error);
              });
     },

     showDesktop: function(){
         if (!this.desktopStream) {
             this.createDesktopStream();
         } else {
             this.addDesktopStreamToMixer();
         }
     },

     hideDesktop: function(){
         if (!this.desktopStream) {
             return;
         }
         this.removeDesktopStreamFromMixer();
     },

     startRecording: function(){
         if (!this.mixStream) {
             return;
         }
         var self = this;
         axios.post('/wcs-rest-api/start-mix-record', {
             mixStreamName: this.mixStreamName,
             eventId: this.EVENT_ID
         })
              .then(function (response) {
                  if (response.data.error) {
                      console.log("Error. Cannot start recording.");
                  } else if (response.data.success) {
                      self.recordedMediaSessionId = response.data.mediaSessionId;
                      self.onRecordingStarted();
                  }
              })
              .catch(function (error) {
                  console.log('AXIOS ERROR: ' + error);
              });
     },

     
     pauseRecording: function(){
         if (!this.recordedMediaSessionId) {
             return;
         }
         var self = this;
         axios.post('/wcs-rest-api/call-action', {
             wcs_entry: '/stream/stopRecording',
             wcs_query: {
                 mediaSessionId: this.recordedMediaSessionId,
             }
         })
              .then(function (response) {
                  if (response.data.error) {
                      console.log("Error. Cannot pause recording.");
                  } else if (response.data.success) {
                      self.recordedMediaSessionId = null;
                      self.onRecordingPaused();
                  }
              })
              .catch(function (error) {
                  console.log('AXIOS ERROR: ' + error);
              });
     },

     onStartBroadcastingButtonClick: function(){
         var status = this.startBroadcastingButton.getAttribute('data-kw-status');
         switch (status) {
             case 'initial':
                 this.startBroadcastingButton.setAttribute('disabled', 'disabled');
                 this.startBroadcastingButton.setAttribute('data-kw-status', 'starting');
                 this.startBroadcastingButton.setAttribute('value', 'Starting...');
                 this.beginBroadcasting();
                 break;
             case 'broadcasting':
                 this.startBroadcastingButton.setAttribute('disabled', 'disabled');
                 this.startBroadcastingButton.setAttribute('data-kw-status', 'terminating');
                 this.startBroadcastingButton.setAttribute('value', 'Terminating...');
                 this.startRecordingButton.setAttribute('disabled', 'disabled');
                 this.showDesktopButton.setAttribute('disabled', 'disabled');
                 this.endBroadcasting();
                 break;
         }
     },

     onStartRecordingButtonClick: function(){
         if ('broadcasting' != this.startBroadcastingButton.getAttribute('data-kw-status') ) {
             return;
         }
         var status = this.startRecordingButton.getAttribute('data-kw-status');
         switch (status) {
             case 'initial':
             case 'paused':
                 this.startRecordingButton.setAttribute('disabled', 'disabled');
                 this.startRecordingButton.setAttribute('data-kw-status', 'starting');
                 this.startRecordingButton.setAttribute('value', 'Starting...');
                 this.startRecording();
                 break;
             case 'recording':
                 this.startRecordingButton.setAttribute('disabled', 'disabled');
                 this.startRecordingButton.setAttribute('data-kw-status', 'pausing');
                 this.startRecordingButton.setAttribute('value', 'Pausing...');
                 this.pauseRecording();
                 break;
         }
     },

     onShowDesktopButtonClick: function(){
         if ('broadcasting' != this.startBroadcastingButton.getAttribute('data-kw-status') ) {
             return;
         }
         var status = this.showDesktopButton.getAttribute('data-kw-status');
         switch (status) {
             case 'initial':
             case 'hidden':
                 this.showDesktopButton.setAttribute('data-kw-status', 'showing');
                 this.showDesktopButton.setAttribute('disabled', 'disabled');
                 this.showDesktopButton.setAttribute('value', 'Showing...');
                 this.showDesktop();
                 break;
             case 'visible':
                 this.showDesktopButton.setAttribute('data-kw-status', 'hiding');
                 this.showDesktopButton.setAttribute('disabled', 'disabled');
                 this.showDesktopButton.setAttribute('value', 'Hiding...');
                 this.hideDesktop();
                 break;
         }
     },

     onSessionStarted: function(){
         this.createCameraStream();
     },

     onCameraStreamPublished: function(){
         this.createMixer();
     },

     onDesktopStreamPublished: function(){
         this.addDesktopStreamToMixer();
     },

     onMixerCreated: function(){
         this.addCameraStreamToMixer();
     },

     onMixerTerminated: function(){
         this.startBroadcastingButton.setAttribute('disabled', 'disabled');
         this.startBroadcastingButton.setAttribute('data-kw-status', 'terminated');
         this.startBroadcastingButton.setAttribute('value', 'Terminated');
         if (this.cameraStream) {
             this.cameraStream.stop();
         }
         if (this.desktopStream) {
             this.desktopStream.stop();
         }
         this.onBroadcastingEnded();
     },

     onCameraStreamAddedToMixer: function(){
         this.playMixerStream();
     },

     onMixerStreamPlaying: function(){
         this.startBroadcastingButton.removeAttribute('disabled');
         this.startBroadcastingButton.setAttribute('data-kw-status', 'broadcasting');
         this.startBroadcastingButton.setAttribute('value', 'Terminate Broadcasting');
         this.startRecordingButton.removeAttribute('disabled');
         this.showDesktopButton.removeAttribute('disabled');
         this.onBroadcastingBegan();
     },

     onDesktopStreamAddedToMixer: function(){
         this.showDesktopButton.setAttribute('data-kw-status', 'visible');
         this.showDesktopButton.removeAttribute('disabled');
         this.showDesktopButton.setAttribute('value', 'Hide Desktop');
     },

     onDesktopStreamRemovedFromMixer: function(){
         this.showDesktopButton.setAttribute('data-kw-status', 'hidden');
         this.showDesktopButton.removeAttribute('disabled');
         this.showDesktopButton.setAttribute('value', 'Show Desktop');
     },

     onRecordingStarted: function(){
         this.startRecordingButton.removeAttribute('disabled');
         this.startRecordingButton.setAttribute('data-kw-status', 'recording');
         this.startRecordingButton.setAttribute('value', 'Pause Recording');
     },

     onRecordingPaused: function(){
         this.startRecordingButton.removeAttribute('disabled');
         this.startRecordingButton.setAttribute('data-kw-status', 'paused');
         this.startRecordingButton.setAttribute('value', 'Resume Recording');
     },

     onBroadcastingBegan: function(){
         if (!this.mixStreamName) {
             return;
         }
         axios.post('/trigger-system-event', {
             event_id: this.EVENT_ID,
             trigger: 'webinar:mix-stream-started',
             stream_name: this.mixStreamName
         })
              .then(function (response) {
                  // use response.data object to handle response
              })
              .catch(function (error) {
                  console.log('AXIOS ERROR: ' + error);
              });
     },

     onBroadcastingEnded: function(){
     }
 };

 $(document).ready(function(){
     KmvWebinar.init();
 });
