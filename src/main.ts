import './styles.css';
import { Game } from './game/Game';

const mount = document.querySelector<HTMLDivElement>('#app');

if (!mount) {
  throw new Error('Missing #app mount point');
}

const game = new Game(mount);
game.run();

window.addEventListener('beforeunload', () => game.dispose());
