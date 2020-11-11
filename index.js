'use strict';

// warning: this code isnt meant to be maintainable
// its all quick and dirty

window.onresize = _ => {
	// We execute the same script as before
	let vh = window.innerHeight * 0.01;
	document.documentElement.style.setProperty('--vh', `${vh}px`);
};
window.onresize();

const ws = new WebSocket("wss://litama.herokuapp.com");

const cards = {};
for (let card of CARDS.base)
	cards[card.name] = card;

class Card {
	constructor(flipped) {
		this.el = document.createElement("game-card");
		this.flip(flipped)
		this.gridEl = document.createElement("game-card-grid");
		for (let i = 0; i < 25; i++)
			this.gridEl.append(document.createElement("game-card-grid-cell"));
		this.el.append(this.gridEl);
		this.nameEl = document.createElement("game-card-name");
		this.el.append(this.nameEl);
	}
	flip(flipped) {
		if (flipped)
			this.el.setAttribute("flipped", "");
		else
			this.el.removeAttribute("flipped");
		this.flipped = flipped;
	}
	set(name) {
		const type = cards[name];
		this.name = name;
		this.nameEl.innerText = name;
		this.moves = this.flipped ? type.moves : type.moves.split("").reverse().join("");
		for (let i = 0; i < 25; i++)
			this.gridEl.children[i].setAttribute("possible", this.moves[i]);
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
const cardChoiceOverlay = document.createElement("game-choice-overlay");
cardChoiceOverlay.onclick = _ => {
	cardChoiceOverlay.removeAttribute("visible");
	selectedCell = undefined;
	removeHighlights();
};
boardContainer.append(cardChoiceOverlay);
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


let currentCards = [];
let highlights = [];
let selectedCell;
let latestData;
function removeHighlights() {
	if (selectedCell)
		return;
	for (let el of highlights)
		el.remove();
	highlights = [];
	if (latestData)
		for (let card of board.cards.bottom) {
			card.el.removeAttribute("highlighted");
			if (card.el.hasAttribute("highlighted-individual")) {
				card.el.removeAttribute("highlighted-individual");
				card.gridEl.querySelector("[highlighted]").removeAttribute("highlighted");
			}
		}
}
board.el.onclick = _ => {
	if (!selectedCell)
		return;
		selectedCell = undefined;
	removeHighlights();
}
let lastPollTimer;
function setBoard(data) {
	if (latestData && latestData.moves.length > data.moves.length)
		return;
	latestData = data;
	clearTimeout(lastPollTimer);
	//lastPollTimer = setTimeout(_ => ws.send("state " + latestData.matchId), 5000);
	removeHighlights();
	if (latestData.gameState != "in progress")
		return console.error("game ended..");
	const participating = localStorage["match-" + data.matchId];
	const flipped = participating && participating[0] == "B";
	const token = participating && participating.substr(1);
	if (token)
		board.el.setAttribute("playable", participating[0] == "B" ? "blue" : "red");
	else
		board.el.removeAttribute("playable");
	board.el.setAttribute("turn", data.currentTurn);
	if (flipped) {
		board.el.setAttribute("flipped", "");
		board.cards.red = board.cards.top;
		board.cards.blue = board.cards.bottom;
	} else {
		board.el.removeAttribute("flipped");
		board.cards.red = board.cards.bottom;
		board.cards.blue = board.cards.top;
	}
	board.cards.blue[0].set(data.cards.blue[0]);
	board.cards.blue[1].set(data.cards.blue[1]);
	board.cards.side.flip((participating[0] == "B") == (data.currentTurn == "red"));
	board.cards.side.set(data.cards.side);
	board.cards.red[0].set(data.cards.red[0]);
	board.cards.red[1].set(data.cards.red[1]);
	currentCards = data.currentTurn == "blue" ? board.cards.blue : board.cards.red;

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
			const toCell = newPieces[type][i];
			const fromCell = removedPieces[type][i];
			const piece = fromCell.piece;
			toCell.piece = piece;
			fromCell.piece = undefined;
			piece.x = toCell.x;
			piece.y = toCell.y;
			piece.el.style.setProperty("--x", toCell.x);
			piece.el.style.setProperty("--y", toCell.y);
			piece.el.setAttribute("moving", "");
			setTimeout(_ => piece.el.removeAttribute("moving"));
		}
		for (; i < removedPieces[type].length; i++) {
			// delete piece
			const cell = removedPieces[type][i];
			const piece = cell.piece;
			console.log("deleting", piece);
			piece.remove = true;
			cell.piece.el.setAttribute("deleting", "");
			window.requestAnimationFrame(_ => setTimeout(_ => piece.el.remove(), 250));
			cell.piece = undefined;
		}
		for (; i < newPieces[type].length; i++) {
			// create piece
			const cell = newPieces[type][i];
			const piece = {
				el: document.createElement("game-piece"),
				value: type + 1,
				x: cell.x,
				y: cell.y,
			};
			cell.piece = piece;
			let side = type < 2 ? "blue" : "red";
			piece.el.setAttribute(side, "");
			if (type % 2 == 1)
				piece.el.setAttribute("master", "");
			piece.el.style.setProperty("--x", cell.x);
			piece.el.style.setProperty("--y", cell.y);
			board.el.append(piece.el);
			window.requestAnimationFrame(_ => window.requestAnimationFrame(_ => piece.el.style.setProperty("opacity", 1)));
			piece.el.onclick = e => {
				if (selectedCell)
					return;
				piece.el.onmouseenter();
				selectedCell = cell;
				e.stopPropagation();
			}
			piece.el.onmouseenter = _ => {
				console.log("hi");
				if (selectedCell || piece.removed)
					return;
				removeHighlights();
				let allUsableCards = [];
				for (let i = 0; i < 25; i++) {
					const y = piece.y - Math.floor(i / 5) + 2;
					const x = piece.x + (i % 5) - 2;
					if (x < 0 || x >= 5 || y < 0 || y >= 5)
						continue;
					if (board.cells[y][x].piece && ((board.cells[y][x].piece.value <= 2) == (piece.value <= 2)))
						continue;
					let usableCards = [];
					for (let j = 0; j < currentCards.length; j++) {
						const card = currentCards[j];
						if (card.moves[piece.value <= 2 ? i : 24 - i] == '1') {
							usableCards.push(j);
							if (allUsableCards.indexOf(j) == -1)
								allUsableCards.push(j);
							card.el.setAttribute("highlighted", "");
							continue;
						}
					}
					if (!usableCards.length)
						continue;
					let highlightEl = document.createElement("game-ghost-piece");
					if (type % 2 == 1)
						highlightEl.setAttribute("master", "");
					highlightEl.style.setProperty("--x", x);
					highlightEl.style.setProperty("--y", y);
					board.el.append(highlightEl);
					highlights.push(highlightEl);
					highlightEl.onmouseover = _ => {
						for (let j of allUsableCards)
							if (usableCards.indexOf(j) == -1)
								currentCards[j].el.removeAttribute("highlighted");
							else {
								currentCards[j].el.setAttribute("highlighted-individual", "");
								currentCards[j].gridEl.children[piece.value <= 2 ? i : 24 - i].setAttribute("highlighted", "");
							}
					};
					highlightEl.onmouseleave = _ => {
						if (cardChoiceOverlay.hasAttribute("visible"))
							return;
						for (let j of allUsableCards)
							currentCards[j].el.setAttribute("highlighted", "");
						for (let j of usableCards) {
							currentCards[j].el.removeAttribute("highlighted-individual");
							currentCards[j].gridEl.children[piece.value <= 2 ? i : 24 - i].removeAttribute("highlighted");
						}
					};
					highlightEl.onclick = _ => {
						if (piece.removed)
							return;
							
						const submitMove = cardChoice => {
							const card = currentCards[usableCards[cardChoice]];
							const pos = "abcde"[piece.x] + (piece.y+1) + "abcde"[x] + (y+1);
							ws.send("move " + latestData.matchId + " " + localStorage["match-" + latestData.matchId].substr(1) + " " + card.name + " " + pos);
							let predictedBoard = latestData.board.split("");
							predictedBoard[x + 5 * y] = predictedBoard[piece.x + 5 * piece.y];
							predictedBoard[piece.x + 5 * piece.y] = '0';
							let predictedCards = latestData.cards;
							let lastSideCard = latestData.cards.side;
							predictedCards.side = latestData.cards[latestData.currentTurn][usableCards[cardChoice]];
							predictedCards[latestData.currentTurn][usableCards[cardChoice]] = lastSideCard;
							setBoard({
								gameState: latestData.gameState,
								matchId: latestData.matchId,
								currentTurn: latestData.currentTurn == "red" ? "blue" : "red",
								startingCards: latestData.startingCards,
								moves: latestData.moves.concat([card.name + ":" + pos]),
								winner: "none",
								board: predictedBoard.join(""),
								cards: predictedCards,
							});
						};

						selectedCell = undefined;
						if (usableCards.length > 1) {
							cardChoiceOverlay.setAttribute("visible", "");
							for (let j of usableCards) {
								const card = currentCards[j];
								card.el.onclick = _ => {
									for (let j of usableCards)
										currentCards[j].el.onclick = undefined;
									cardChoiceOverlay.removeAttribute("visible");
									submitMove(j);
								};
							}
							for (let highlight of highlights)
								if (highlight != highlightEl)
									highlight.remove();
							highlights = [highlightEl];
						} else
							submitMove(0);
					};
				}
			};
			piece.el.onmouseleave = removeHighlights;
		}
	}
}


let subscribed = false;
ws.onerror = initialiseMainPage;
ws.onmessage = e => {
	const data = JSON.parse(e.data);
	switch(data.messageType) {
	case "state":
		let joining = false;
		switch(data.gameState) {
		case "waiting for player":
			if (!localStorage["match-" + data.matchId])
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
	case "move":
		break;
	case "join":
	case "create":
		console.log(data);
		localStorage["match-" + data.matchId] = (data.color == "red" ? "R" : "B") + data.token;
		history.pushState(undefined, undefined, window.location.pathname + "#" + data.matchId);
		window.location.reload();
		break;
	case "error":
	default:
		if (data.command == "heartbeat")
			return;
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
	ws.onclose = _ => setTimeout(_ => window.location.reload(), 1000);
} else
	initialiseMainPage();


function initialiseMainPage() {

}