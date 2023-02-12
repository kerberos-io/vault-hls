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
      'X-Kerberos-Storage-SecretAccessKey': 'xxxx', // Kerberos Vault account secret access key
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
      this.player.src(sources);
    });
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
    moment.locale('en');
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
