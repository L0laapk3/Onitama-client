'use strict';

const cards = {};
for (let card of CARDS.base)
	cards[card.name] = card;

class Card {
	constructor(flipped) {
		this.el = document.createElement("game-card");
		if (flipped)
			this.el.setAttribute("flipped", "");
		this.flipped = flipped;
		this.gridEl = document.createElement("game-card-grid");
		for (let i = 0; i < 25; i++)
			this.gridEl.append(document.createElement("game-card-grid-cell"));
		this.el.append(this.gridEl);
		this.nameEl = document.createElement("game-card-name");
		this.el.append(this.nameEl);
	}
	set(name) {
		const type = cards[name];
		this.nameEl.innerText = name;
		for (let i = 0; i < 25; i++) {
			this.gridEl.children[i].setAttribute("possible", type.moves[this.flipped ? i : 24 - i]);
		}
	}
}
const board = {
	cards: {
		top: [new Card(true), new Card(true)],
		side: new Card(),
		bottom: [new Card(), new Card()],
	},
	el: document.createElement("game-board"),
	cells: [[], [], [], [], []]
};
const container = document.getElementsByTagName("game-container")[0];
const boardContainer = document.createElement("board-container");
boardContainer.append(board.cards.top[0].el);
boardContainer.append(board.cards.top[1].el);
boardContainer.append(board.el);
boardContainer.append(board.cards.bottom[0].el);
boardContainer.append(board.cards.bottom[1].el);
container.append(boardContainer);
container.append(board.cards.side.el);
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
	const participating = localStorage["match-" + data.matchId];
	const flipped = participating && participating[0] == "B";
	const token = participating && participating.substr(1);
	if (flipped) {
		board.el.setAttribute("flipped", "");
		board.cards.red = board.cards.top;
		board.cards.blue = board.cards.bottom;
	} else {
		board.cards.red = board.cards.bottom;
		board.cards.blue = board.cards.top;
		board.el.removeAttribute("flipped");
	}
	board.cards.blue[0].set(data.cards.blue[0]);
	board.cards.blue[1].set(data.cards.blue[1]);
	board.cards.side.set(data.cards.side);
	board.cards.red[0].set(data.cards.red[0]);
	board.cards.red[1].set(data.cards.red[1]);

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
	for (let type = 0; type < 4; type++) {
		let i = 0;
		for (; i < Math.min(newPieces[type].length, removedPieces[type].length); i++) {
			// move piece
			const fromCell = newPieces[type][i];
			const toCell = removedPieces[type][i];
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
			cell.piece.el.style.setProperty("--x", cell.x);
			cell.piece.el.style.setProperty("--y", cell.y);
			board.el.append(cell.piece.el);
			window.requestAnimationFrame(_ => window.requestAnimationFrame(_ => cell.piece.el.style.setProperty("opacity", 1)));
		}
		for (; i < removedPieces[type].length; i++) {
			// delete piece
			const cell = removedPieces[type][i];
			cell.piece.el.style.setProperty("opacity", 0);
			window.requestAnimationFrame(_ => setTimeout(_ => cell.piece.el.remove(), 500));
			cell.piece = undefined;
		}
	}
}


let subscribed = false;
const ws = new WebSocket("wss://litama.herokuapp.com");
ws.onerror = initialiseMainPage;
ws.onmessage = e => {
	const data = JSON.parse(e.data);
	console.log(data);
	switch(data.messageType) {
	case "state":
		let joining = false;
		switch(data.gameState) {
		case "waiting for player":
			ws.send("join " + data.matchId);
			joining = true;
		case "in progress":
			if (!subscribed)
				ws.send("spectate " + data.matchId);
			if (joining)
				break;
			setBoard(data);
			break;
		}
		break;
	case "spectate":
		subscribed = true;
		break;
	case "join":
	case "create":
		localStorage["match-" + data.matchId] = (data.color == "red" ? "R" : "B") + data.token;
		break;
	case "error":
	default:
		console.error(data);
		if (data.command == "state") {
			delete localStorage["match-" + match[1]];
			initialiseMainPage();
		}
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