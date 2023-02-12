import Videojs from './video.js';

function App() {
  const options = {
    autoplay: true,
    controls: true,
  };
  return (
    <div className="App">
      <Videojs {...options} />
    </div>
  );
}

export default App;
