import React from 'react';
import ReactDOM from 'react-dom';
import LoadingScreen from './components/LoadingScreen';
import SceneHints from './components/SceneHints';
import InterfaceUI from './components/InterfaceUI';
import './style.css';

const App = () => (
    <div id="ui-app">
        <SceneHints />
        <LoadingScreen />
    </div>
);

const createUI = () => {
    ReactDOM.render(<App />, document.getElementById('ui'));
};

const createVolumeUI = () => {
    ReactDOM.render(<InterfaceUI />, document.getElementById('ui-interactive'));
};

export { createUI, createVolumeUI };
