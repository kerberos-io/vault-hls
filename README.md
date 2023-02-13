# Kerberos Vault

This repository showcases how to build an HLS stream of fragmented MP4s stored in Kerberos Vault. An event list is shown which allows you to browse through the HLS steam.

![Kerberos Vault HLS viewer](./hls-viewer.png)

When clicking on the fragments (boxes) and timings, the `videojs` player will navigate through the HLS stream showing the relevant part of the entire recording.

## Some background

[Kerberos Agents](https://github.com/kerberos-io/agent) are connected to IP cameras and are recording (fragmented) MP4s based on specific conditions/configurations. Those recordings are stored in [Kerberos Vault](https://github.com/kerberos-io/vault) on a specific storage provider (AWS, Minio, Google storage, etc).

Once the recording is stored, several information is calculated, such as the fragment durations (if recording is fragmented). This information can be used to build up a HLS stream `.m3u8` file.

## HLS - m3u8 file

There are several ways to stream recordings into a browser, such as HLS, Dash and others. Within the Kerberos.io suite we are working with HLS as our standard, as it supports the streaming of fragmented MP4s.

A typical `.m3u8` file will look like this.

    #EXTM3U
    #EXT-X-VERSION:7
    #EXT-X-TARGETDURATION:30
    #EXT-X-MEDIA-SEQUENCE:1
    #EXT-X-PLAYLIST-TYPE:VOD
    #EXT-X-INDEPENDENT-SEGMENTS
    #EXT-X-MAP:URI="https://gateway.eu1.xxx8f596",BYTERANGE="680@0"
    #EXTINF:19.967000,
    #EXT-X-BYTERANGE:5014474@680
    https://gateway.eu1.xxx8f596
    #EXTINF:19.967000,
    #EXT-X-BYTERANGE:5012356@5015154
    https://gateway.eu1.xxx8f596
    #EXTINF:19.966000,
    #EXT-X-BYTERANGE:5080900@10027510
    https://gateway.eu1.xxx8f596
    #EXTINF:1.996000,
    #EXT-X-BYTERANGE:504350@100477198
    https://gateway.eu1.xxx8f596
    ....
    #EXT-X-DISCONTINUITY
    #EXT-X-MAP:URI="https://gateway.eu1.xxx8f596",BYTERANGE="680@0"
    #EXTINF:19.967000,
    #EXT-X-BYTERANGE:5069836@680
    https://gateway.eu1.xxx8f596
    #EXTINF:19.967000,
    #EXT-X-BYTERANGE:5009316@5070516
    ....
    #EXT-X-ENDLIST

The key elements in previous mentioned `.m3u8` file are `#EXT-X-INDEPENDENT-SEGMENTS` and `#EXT-X-DISCONTINUITY`. These attributes allows us to chain multiple fragmented MP4s and create a single player for multiple recordings. This is useful for a full-day or just showing all the relevant recordings without the need of scrolling through multiple recordings.

## Drifting

The disadvantage of chaining fragmented MP4s into a single HLS stream, is that it may introduce the concept of drifting. It may appear that frames are missing as the full length of the HLS stream is not matching the `start time + end time`. Drifting is caused due to:

- rounding errors while fragmenting from an original recording.
- gaps between two sequential recordings (camera timeout or network interuptions).

To overcome this a technique should be used such as time mapping.

## Time Mapping

As explained above, if you are chaining fragmented MP4s over a long period of time, it might start introducing delays. This is because durations are accumulated over time, and any rounding error in one the previous recordings will extrapolate making the stream duration out of sync with the actual time on the recording. To overcome this issue we introduce a technique that we call time mapping. By doing this we will reset the timer at each fragmented recording.

Instead of using the start time of the recording and than accumaliting the durations for the entire stream, we accumulate the duration for each recording. An example of time mapping is shown in this repository where we are leveraging the `/hls/metadata` of the Kerberos Vault API. By targetting this API we will receive following payload.

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
    }]

As you can notice we will receive an array of recordings, with contains the timestamp (start of the recording in sync with the video), duration of the recording, the duration of each segment in that recording, etc. Please note that the `start` property is an accumulation of each previous duration.

By combining the timestamp of the recording and the durations you can build up an event list which stays in sync during the entire recording. Using the `start` and `timestamp` properties, you'll know precisely at which point in the recording you can find which recording. An example in `javascript` is shown below, how to navigate through the list of recordings.

    { items && items.map((item, i) => (
        <li>
        <div className="row">
            <p onClick={() => this.changeTime(item.start)}>{this.timestampToTime(item.timestamp)}</p>
            <h5>{item.key}</h5>
            <ul>
                { item.bytes_range_on_time && item.bytes_range_on_time.map((range, i) => (
                <li onClick={()=> this.changeTime(item.start+Math.round(range.time))}>
                    <p>F{i} - {this.timestampToTime(item.timestamp+Math.round(range.time))}</p>
                </li>
                ))}
            </ul>
        </div>
        </li>
    )) }

As you can see below, the `start` property is used to navigate to the specific time in the player, but in the UI, it's mapped to the timestamp of the recording. This timing stays in sync with the actual recording time, and avoids any drifts accumulated over time.

    <p onClick={() => this.changeTime(item.start)}>{this.timestampToTime(item.timestamp)}</p>

The same applies if you want to navigate through individual segment times in the fragmented recording. You achieve this by incrementing the starting duration with the individual segment durations.

    { item.bytes_range_on_time && item.bytes_range_on_time.map((range, i) => (
        <li onClick={()=> this.changeTime(item.start+Math.round(range.time))}>
            <p>F{i} - {this.timestampToTime(item.timestamp+Math.round(range.time))}</p>
        </li>
    ))}
