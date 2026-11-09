import React from 'react';
import ReactDOM from 'react-dom';
import Desktop from './Desktop';
import { startBridge } from './bridge';
import './desktop.css';
import './minecraft.css';

startBridge();

ReactDOM.render(<Desktop />, document.getElementById('desktop-root'));
