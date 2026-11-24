import { autoSolve } from './dom.js';
import { initGameController } from '../ui/gameBootstrap.js';

initGameController('sudoku', 'sudokuPopupButtonOnClick', autoSolve);
