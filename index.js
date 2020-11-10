'use strict';

const board = {
	el: document.getElementsByTagName("game-board")[0],
	cells: [[], [], [], [], []]
};
for (let y = 0; y < 5; y++) {
	const rowEl = document.createElement("game-board-row");
	for (let x = 0; x < 5; x++) {
		const cellEl = document.createElement("game-board-cell");
		rowEl.append(cellEl);
		board.cells[y][x] = {
			el: cellEl,
			piece: undefined,
			x: x,
			y: y,
		};
	}
	board.el.append(rowEl);
}
function setBoard(data) {
	let newPieces = [[], [], [], []], i = 0, removedPieces = [[], [], [], []];
	for (let y = 0; y < 5; y++)
		for (let x = 0; x < 5; x++) {
			const p = parseInt(data.board[i]);
			const cell = board.cells[y][x];
			if (cell.piece && cell.piece.value != p)
				removedPieces[cell.piece.value - 1].push(cell);
			if (p && (!cell.piece || cell.piece.value != p)) {
				newPieces[p - 1].push(cell);
			}
			i++;
		}
		console.log(newPieces, removedPieces)
	for (let type = 0; type < 4; type++) {
		let i = 0;
		for (; i < Math.min(newPieces[type].length, removedPieces[type].length); i++) {
			// move piece
			const fromCell = newPieces[type][i];
			const toCell = removedPieces[type][i];
			toCell.el.append(fromCell.piece.el);
			toCell.piece = fromCell.piece;
		}
		for (; i < newPieces[type].length; i++) {
			// create piece
			const cell = newPieces[type][i];
			cell.piece = {
				el: document.createElement("game-piece"),
				value: type + 1,
			};
			if (type < 2)
				cell.piece.el.setAttribute("blue", "");
			else
				cell.piece.el.setAttribute("red", "");
			if (type % 2 == 1)
				cell.piece.el.setAttribute("master", "");
			cell.el.append(cell.piece.el);
		}
		for (; i < removedPieces[type].length; i++) {
			// delete piece
			const cell = removedPieces[type][i];
			cell.piece.el.remove();
			cell.piece = undefined;
		}
	}
}


let subscribed = false;
const ws = new WebSocket("wss://litama.herokuapp.com");
ws.onerror = initialiseMainPage;
ws.onmessage = e => {
	const data = JSON.parse(e.data);
	switch(data.messageType) {
	case "state":
		switch(data.gameState) {
		case "waiting for player":
			ws.send("join " + data.matchId);
		case "in progress":
			if (!subscribed)
				ws.send("spectate " + data.matchId);
			if (data.gameState == "waiting for player")
				break;
			setBoard(data);
			break;
		}
		break;
	case "spectate":
		subscribed = true;
		break;
	case "error":
	default:
		console.error(data);
		if (data.command == "state")
			initialiseMainPage();
		throw Error();
	}
};

const match = document.location.hash.match(/^#([0-9a-f]+)$/i);
if (match) {
	ws.onopen = _ => {
		ws.send("state " + match[1]);
	};
} else
	initialiseMainPage();


function initialiseMainPage() {

}