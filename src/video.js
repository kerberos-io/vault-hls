import React from "react";
import videojs from "video.js";
import moment from 'moment';
import './video.css';

// POST to API with headers
const post = async (url, data, headers) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: data
  });
  return response.json();
}


export default class VideoPlayer extends React.Component {

  constructor() {
    super();
    moment.locale('en');
    this.state = {
      items: []
    };
    this.changeTime = this.changeTime.bind(this);
  }

  // instantiate Video.js
  componentDidMount() {

    // instantiate video.js
    this.player = videojs(this.videoNode, this.props);

    const API_URL = 'https://api.vault.kerberos.io';

    const data = {
      "device": [
        "xxx" // device key
      ],
      "end": 1796148492, // end time of recording
      "start": 1676233123 // start time of recording
    }

    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Kerberos-Storage-Provider': 'xxx', // Kerberos Vault storage provider
      'X-Kerberos-Storage-AccessKey': 'xxx', // Kerberos Vault account access key
      'X-Kerberos-Storage-SecretAccessKey': 'xxx', // Kerberos Vault account secret access key
    }

    // We will create the m3u8 file in memory, and build it up with the data
    // received from the Kerberos Vault API.

    let m3u8File = `
    #EXTM3U
    #EXT-X-VERSION:7
    #EXT-X-TARGETDURATION:30
    #EXT-X-MEDIA-SEQUENCE:1
    #EXT-X-PLAYLIST-TYPE:VOD
    #EXT-X-INDEPENDENT-SEGMENTS\n`

    // This will call the /hls/metadata endpoint of Kerberos Vault
    // and it will return the relevant information to create the m3u8 file
    // we will get the durations, start times, and urls for each segment.
    // This can be used to create an event list, and bring it to the correct time
    // in the video.

    /*
    The Kerberos Vault API will return following payload from'/hls/metadata'
    You'll receive a sequence of mp4 files with the total duration of the recording,
    and the individual durations of each segment. Combining this with the start time of the recording
    you can avoid drifting, and make sure you can navigate correctly through the stream.
    [{
      "key":"1676232722_6-967003_insidegarage_200-200-400-400_0_769.mp4",
      "filename":"cedricve/1676232722_6-967003_insidegarage_200-200-400-400_0_769.mp4",
      "timestamp":1676232722,
      "url":"https://gateway.eu1.storjshare.io/kerberos-hub/cedricve/1676232722_6-967003_insidexxx.mp4?X-Amz-Algorithm=AWS4-HMAC-SHA256xxx",
      "start":0,
      "end":401.32999999999987,
      "duration":401.32999999999987,
      "bytes_ranges":"#EXT-X-MAP:URI=\"1676232722_6-967003_insidegarage_200-200-400-400_0_769.mp4\",BYTERANGE=\"680@0\"\n#EXTINF:19.967000,\n#EXT-X-BYTERANGE:5014474@680\n1676232722_6-...",
      "bytes_range_on_time":[{"duration":"19.967000","time":"19.967000","range":"5014474@680"},{"duration":"19.967000","time":"39.934000","range"...},
    },
    {
      "key":"1676233123_6-967003_insidegarage_200-200-400-400_0_769.mp4",
      "filename":"cedricve/1676233123_6-967003_insidegarage_200-200-400-400_0_769.mp4",
      "timestamp":1676233123,
      "url":"https://gateway.eu1.storjshare.io/kerberos-hub/cedricve/1676233123_6-967003_insidexxx.mp4?X-Amz-Algorithm=AWS4-HMAC-SHA256",
      "start":401.32999999999987,
      "end":800.6639999999998,
      "duration":399.3339999999999,
      "bytes_ranges":"#EXT-X-MAP:URI=\"1676233123_6-967003_insidegarage_200-200-400-400_0_769.mp4\",BYTERANGE=\"680@0\"\n#EXTINF:19.967000,\n#EXT-X-BYTERANGE:5069836@680\n1676233123_6-...",
      "bytes_range_on_time":[{"duration":"19.967000","time":"19.967000","range":"5069836@680"},{"duration":"19.967000","time":"39.934000","range"...},
    }]*/

    post(API_URL + '/hls/metadata', JSON.stringify(data), headers).then((data) => {
      this.setState({ items: data });
      data.forEach((item, i) => {
        const ranges = item.bytes_ranges.replaceAll(item.key, item.url)
        m3u8File += ranges

        // Each time we have a new recording (item) we will add a discontinuity
        // to the m3u8 file.
        if (i < data.length - 1) {
          m3u8File += "#EXT-X-DISCONTINUITY\n"
        }
      })

      // Add the end list to the m3u8 file
      // We will close the list.
      m3u8File += "#EXT-X-ENDLIST"

      // Set the blob url as the source of the video player
      const blob = URL.createObjectURL(new Blob([m3u8File], {type: 'application/x-mpegURL'}));
      const sources = [{
        src: blob,
        type: 'application/x-mpegURL'
      }];

      // 
      this.player.src(sources);
      this.addCustomTimeDisplay();
    });
  }

  addCustomTimeDisplay() {
    // Create a custom TimeDisplay
    const { items } = this.state;

    // Create a custom DurationDisplay
    const CustomTimeDisplay = videojs.getComponent('TimeDisplay');
    const customTimeDisplay = new CustomTimeDisplay(this.player, {
      el: videojs.createEl('div', {
        className: 'vjs-custom-time-display vjs-time-control vjs-control',
      }),
      data: items
    });

    // Overwrite the default time display with our custom time display
    customTimeDisplay.updateContent = function(props) {
      let time = this.player_.scrubbing() ? this.player_.getCache().currentTime : this.player_.currentTime();
      // Find start time
      let startTime = 0;
      // Iterate over data
      const { data } = this.options_;
      data.forEach((item) => {
        if (time >= item.start && time <= item.end) {
          startTime = item.timestamp;
          time = time - item.start;
        }
      });
      const formattedTime = moment.unix(startTime + Math.round(time)).format('MM-DD-YYYY HH:mm:ss');
      const endTime = data[data.length - 1].timestamp;
      const endDuration = data[data.length - 1].duration;
      const formattedEnd = moment.unix(endTime + Math.round(endDuration)).format('MM-DD-YYYY HH:mm:ss');
      this.el_.innerHTML = `<span class="vjs-control-text">Current Time </span>
        ${formattedTime} / ${formattedEnd}
        <span class="vjs-control-text"> seconds</span>`;
    };

    // Add the custom time display to the player
    this.player.addChild(customTimeDisplay, {}, 3);
  }

  changeTime(time) {
    this.player.currentTime(time);
    this.player.pause();
  }

  // destroy player on unmount
  componentWillUnmount() {
    if (this.player) {
      this.player.dispose();
    }
  }

  timestampToTime(timestamp) {
    return moment.unix(timestamp).format('MMM Do YYYY, h:mm:ss a');
  }

  secondsToReadable(seconds) {
    const date = new Date(null);
    date.setSeconds(seconds); // specify value for SECONDS here
    return date.toISOString().substr(11, 8);
  }

  // wrap the player in a div with a `data-vjs-player` attribute
  // so videojs won't create additional wrapper in the DOM
  // see https://github.com/videojs/video.js/pull/3856
  render() {
    const { items } = this.state;
    return (
      <div className="grid-container">
        <div className="player grid-item" data-vjs-player>
          <video ref={node => (this.videoNode = node)} className="video-js" />
        </div>
        <div className="list grid-item">
          <ul className="list-group">
            { items && items.map((item, i) => (
              <li key={i} className="list-group-item">
                <div className="row">
                  <div></div>
                    <p className="pointer" onClick={() => this.changeTime(item.start)}>{this.timestampToTime(item.timestamp)}</p>
                    <h5>{item.key}</h5>
                    <ul className="grid-container-6">
                      { item.bytes_range_on_time && item.bytes_range_on_time.map((range, i) => (
                        <li className="pointer" key={i} onClick={()=> this.changeTime(item.start+Math.round(range.time))}>
                          <p>F{i} - {this.timestampToTime(item.timestamp+Math.round(range.time))}</p>
                        </li>
                      ))}
                    </ul>
                </div>
              </li>
            )) }
          </ul>
        </div>
      </div>
    );
  }
}
