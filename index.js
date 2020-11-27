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
	flipSet() {
		for (let i = 0; i < 12; i++) {
			const one = this.gridEl.children[i];
			const two = this.gridEl.children[24 - i];
			const onePossible = one.getAttribute("possible");
			one.setAttribute("possible", two.getAttribute("possible"));
			two.setAttribute("possible", onePossible);
		}
	}
	set(name) {
		const type = cards[name];
		this.name = name;
		this.nameEl.innerText = name;
		this.moves = this.flipped ? type.moves : type.moves.split("").reverse().join("");
		for (let i = 0; i < 25; i++)
			this.gridEl.children[i].setAttribute("possible", this.moves[i]);
	}
	setOwned(owned) {
		if (owned)
			this.el.setAttribute("owned", "");
		else
			this.el.removeAttribute("owned");
	}
}
const gameBoard = {
	cards: {
		top: [new Card(true), new Card(true)],
		side: new Card(),
		bottom: [new Card(), new Card()],
	},
	el: document.createElement("game-board"),
	cells: [[], [], [], [], []]
};
for (let y = 0; y < 5; y++) {
	const rowEl = document.createElement("game-board-row");
	for (let x = 0; x < 5; x++) {
		const cellEl = document.createElement("game-board-cell");
		rowEl.append(cellEl);
		// gameBoard.cells[y][x] = {
		// 	el: cellEl,
		// 	piece: undefined,
		// 	x: x,
		// 	y: y,
		// };
	}
	gameBoard.el.append(rowEl);
}
const waitingEl = document.createElement("game-waiting");
gameBoard.el.appendChild(waitingEl);
const piecesEl = document.createElement("board-pieces");
const ghostPiecesEl = document.createElement("board-ghost-pieces");
const pieces = [];
let piecesZ;
let lastPositions;
let board;
for (let y = 0; y < 5; y += 4)
	for (let x = 5; x--> 0;) {
		const el = document.createElement("game-piece");
		el.style.setProperty("--x", x);
		el.style.setProperty("--y", y);
		const piece = {
			el: el,
			x: x,
			y: y,
			color: y ? "red" : "blue",
			isMaster: x == 2,
		};
		if (piece.isMaster)
			el.setAttribute("master", "");
		el.setAttribute("color", piece.color);
		pieces.push(piece);
		piecesEl.append(el);
	}
const startBoard = { pieces: [
	 0,  1,  2,  3,  4,
	-1, -1, -1, -1, -1, 
	-1, -1, -1, -1, -1, 
	-1, -1, -1, -1, -1, 
	 5,  6,  7,  8,  9,
]};
let moves = [];
gameBoard.el.append(piecesEl);
gameBoard.el.append(ghostPiecesEl);
const redNameEl = document.createElement("board-red-name");
gameBoard.el.append(redNameEl);
const blueNameEl = document.createElement("board-blue-name");
gameBoard.el.append(blueNameEl);
const container = document.getElementsByTagName("game-container")[0];
const boardContainer = document.createElement("board-container");
boardContainer.append(gameBoard.cards.top[0].el);
boardContainer.append(gameBoard.cards.top[1].el);
boardContainer.append(gameBoard.el);
const cardChoiceOverlay = document.createElement("game-choice-overlay");
cardChoiceOverlay.onclick = _ => {
	cardChoiceOverlay.removeAttribute("visible");
	selectedPiece = undefined;
	removeHighlights();
};
boardContainer.append(cardChoiceOverlay);
boardContainer.append(gameBoard.cards.bottom[0].el);
boardContainer.append(gameBoard.cards.bottom[1].el);
const sidebarContainer = document.createElement("sidebar-container");
const createNewButton = document.createElement("sidebar-create-button");
createNewButton.onclick = _ => initialiseMainPage();
sidebarContainer.append(createNewButton);
sidebarContainer.append(gameBoard.cards.side.el);
const playingAs = document.createElement("sidebar-playing-as");
const clickToFlip = document.createElement("sidebar-clickToFlip");
playingAs.append(clickToFlip);
sidebarContainer.append(playingAs);
container.append(sidebarContainer);
container.append(boardContainer);

function getBoardAtPly(ply) {
	piecesZ = new Array(10).fill(0);
	lastPositions = new Array(10);
	board = JSON.parse(JSON.stringify(startBoard));
	for (let i = 0; i < ply; i++) {
		const match = moves[i].match(/([^:]+):([a-e])([1-5])([a-e])([1-5])/);
		const cardI = board.cards[board.turn].findIndex(c => c == match[1]);
		board.cards[board.turn][cardI] = board.cards.side;
		board.cards.side = match[1];
		const sourceI = "abcde".indexOf(match[2])+parseInt(match[3])*5-5;
		const targetI = "abcde".indexOf(match[4])+parseInt(match[5])*5-5;
		if (board.pieces[targetI] != -1)
			lastPositions[board.pieces[targetI]] = targetI;
		piecesZ[board.pieces[sourceI]] = i + 1;
		board.pieces[targetI] = board.pieces[sourceI];
		board.pieces[sourceI] = -1;
		board.turn = board.turn == "blue" ? "red" : "blue";
	}
}


let currentCards = [];
let highlights = [];
let selectedPiece;
let latestData;
function removeHighlights() {
	if (selectedPiece)
		return;
	for (let el of highlights)
		el.remove();
	highlights = [];
	if (latestData)
		for (let card of gameBoard.cards[latestData.currentTurn]) {
			card.el.removeAttribute("highlighted");
			if (card.el.hasAttribute("highlighted-individual")) {
				card.el.removeAttribute("highlighted-individual");
				card.gridEl.querySelector("[highlighted]").removeAttribute("highlighted");
			}
		}
}
gameBoard.el.onclick = _ => {
	if (!selectedPiece)
		return;
		selectedPiece = undefined;
	removeHighlights();
}
let lastMatchId;
let lastPollTimer;
let lastboardstr;
let inverted = false;
function setBoard(data) {
	if (latestData && latestData.moves.length > data.moves.length)
		return;
	moves = data.moves;
	startBoard.cards = data.startingCards;
	startBoard.turn = CARDS.base.find(c => c.name == data.startingCards.side).color;
	getBoardAtPly(data.moves.length);
	const piecesPositions = new Array(10).fill(-1);
	for (let i = 0; i < 25; i++)
		if (board.pieces[i] >= 0)
			piecesPositions[board.pieces[i]] = i;

	clearTimeout(lastPollTimer);
	// lastPollTimer = setTimeout(_ => ws.send("state " + latestData.matchId), 5000);
	removeHighlights();
	container.setAttribute("ongoing", "");
	if (data.usernames) {
		redNameEl.innerText = "";
		blueNameEl.innerText = "";
		window.requestAnimationFrame(_ => window.requestAnimationFrame(_ => {
			redNameEl.innerText = data.usernames.red;
			blueNameEl.innerText = data.usernames.blue;
		}));
	}
	const participating = localStorage["match-" + data.matchId];
	const isBlue = participating && (parseInt(participating[0]) == data.indices.blue);
	let flipped = participating ? isBlue : data.indices.blue;
	const token = participating && participating.substr(1);
	if (data.gameState == "ended") {
		container.removeAttribute("playable");
		container.setAttribute("winner", data.winner);
		gameBoard.el.removeAttribute("turn");
	} else {
		container.removeAttribute("winner");
		if (token)
			container.setAttribute("playable", isBlue ? "blue" : "red");
		else
			container.removeAttribute("playable");
		gameBoard.el.setAttribute("turn", data.currentTurn);
	}
	if (!latestData) {
		const fixFlip = _ => {
			if (flipped) {
				gameBoard.el.setAttribute("flipped", "");
				gameBoard.cards.red = gameBoard.cards.top;
				gameBoard.cards.blue = gameBoard.cards.bottom;
			} else {
				gameBoard.el.removeAttribute("flipped");
				gameBoard.cards.red = gameBoard.cards.bottom;
				gameBoard.cards.blue = gameBoard.cards.top;
			}
			for (let card of gameBoard.cards.blue)
				card.setOwned(participating && isBlue)
			for (let card of gameBoard.cards.red)
				card.setOwned(participating && !isBlue)
		};
		fixFlip();
		if (flipped) {
			for (let i = 0; i < 5; i++) {
				const tmp = pieces[i].el;
				pieces[i + 5].el.setAttribute("color", tmp.getAttribute("color") == "blue" ? "blue" : "red");
				tmp.setAttribute("color", tmp.getAttribute("color") == "blue" ? "red" : "blue");
				pieces[i].el = pieces[i + 5].el;
				pieces[i + 5].el = tmp;
				pieces[i].y = 4 - pieces[i].y;
				pieces[i + 5].y = 4 - pieces[i + 5].y;
			}
			for (let i = 0; i < 2; i++) // no idea why this loop is necessary
				for (let j = 0; j <= 5; j += 5) {
					const tmp = pieces[i + j].el;
					pieces[i + j].el = pieces[4 - i + j].el;
					pieces[4 - i + j].el = tmp;
				}
		}
		playingAs.onclick = _ => {
			selectedPiece = undefined;
			removeHighlights();
			flipped = !flipped;
			inverted = !inverted;
			const topCards = [gameBoard.cards.top[0].name, gameBoard.cards.top[1].name];
			gameBoard.cards.top[0].set(gameBoard.cards.bottom[0].name);
			gameBoard.cards.top[1].set(gameBoard.cards.bottom[1].name);
			gameBoard.cards.bottom[0].set(topCards[0]);
			gameBoard.cards.bottom[1].set(topCards[1]);
			fixFlip();
			currentCards = data.currentTurn == "blue" ? gameBoard.cards.blue : gameBoard.cards.red;
			gameBoard.cards.side.flip(((participating  && isBlue) == (latestData.currentTurn == "red")) != inverted);
			gameBoard.cards.side.flipSet();
		};
		for (let i = 0; i < 10; i++) {
			const piece = pieces[i];
			piece.el.onclick = e => {
				if (selectedPiece)
					return;
				piece.el.onmouseenter();
				selectedPiece = piece;
				e.stopPropagation();
			}
			piece.el.onmouseenter = _ => {
				if (selectedPiece || piece.el.hasAttribute("dead"))
					return;
				removeHighlights();
				let allUsableCards = [];
				for (let i = 0; i < 25; i++) {
					const y = piece.y - Math.floor(i / 5) + 2;
					const x = piece.x + (i % 5) - 2;
					if (x < 0 || x >= 5 || y < 0 || y >= 5)
						continue;
					if (board.pieces[(4-x)+5*y] != -1 && Math.floor(board.pieces[(4-x)+5*y] / 5) == (piece.color == "red" ? 1 : 0))
						continue;
					let usableCards = [];
					for (let j = 0; j < currentCards.length; j++) {
						const card = currentCards[j];
						if (card.moves[((piece.color == "blue") != inverted) ? i : 24 - i] == '1') {
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
					if (piece.isMaster)
						highlightEl.setAttribute("master", "");
					highlightEl.style.setProperty("--x", x);
					highlightEl.style.setProperty("--y", y);
					ghostPiecesEl.append(highlightEl);
					highlights.push(highlightEl);
					highlightEl.onmouseover = _ => {
						for (let j of allUsableCards)
							if (usableCards.indexOf(j) == -1)
								currentCards[j].el.removeAttribute("highlighted");
							else {
								currentCards[j].el.setAttribute("highlighted-individual", "");
								currentCards[j].gridEl.children[(piece.color == "blue") != inverted ? i : 24 - i].setAttribute("highlighted", "");
							}
					};
					highlightEl.onmouseleave = _ => {
						if (cardChoiceOverlay.hasAttribute("visible"))
							return;
						for (let j of allUsableCards)
							currentCards[j].el.setAttribute("highlighted", "");
						for (let j of usableCards) {
							currentCards[j].el.removeAttribute("highlighted-individual");
							currentCards[j].gridEl.children[(piece.color == "blue") != inverted ? i : 24 - i].removeAttribute("highlighted");
						}
					};
					highlightEl.onclick = _ => {
						if (piece.removed)
							return;
							
						const submitMove = cardChoice => {
							const card = currentCards[usableCards[cardChoice]];
							console.log(piece.x, piece.y, x, y);
							const pos = "edcba"[piece.x] + (piece.y+1) + "edcba"[x] + (y+1);
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
								indices: latestData.indices,
							});
						};

						selectedPiece = undefined;
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
	latestData = data;
	gameBoard.cards.blue[0].set(data.cards.blue[0]);
	gameBoard.cards.blue[1].set(data.cards.blue[1]);
	gameBoard.cards.side.flip(((participating && isBlue) == (data.currentTurn == "red")) != inverted);
	gameBoard.cards.side.set(data.cards.side);
	gameBoard.cards.red[0].set(data.cards.red[0]);
	gameBoard.cards.red[1].set(data.cards.red[1]);
	currentCards = data.currentTurn == "blue" ? gameBoard.cards.blue : gameBoard.cards.red;

	
	for (let i = 0; i < 10; i++) {
		let position;
		if (piecesPositions[i] == -1) {
			pieces[i].el.setAttribute("dead", "");
			position = lastPositions[i];
		} else {
			pieces[i].el.removeAttribute("dead", "");
			position = piecesPositions[i];
		}
		pieces[i].el.style.setProperty("z-index", piecesZ[i]);
		pieces[i].x = 4 - position % 5;
		pieces[i].y = Math.floor(position / 5);
		pieces[i].el.style.setProperty("--x", pieces[i].x);
		pieces[i].el.style.setProperty("--y", pieces[i].y);
	}

	// let newPieces = [[], [], [], []], i = 0, removedPieces = [[], [], [], []];
	// for (let y = 0; y < 5; y++)
	// 	for (let x = 0; x < 5; x++) {
	// 		const p = parseInt(data.board[i]);
	// 		const cell = gameBoard.cells[y][x];
	// 		if (cell.piece && cell.piece.value != p)
	// 			removedPieces[cell.piece.value - 1].push(cell);
	// 		if (p && (!cell.piece || cell.piece.value != p))
	// 			newPieces[p - 1].push(cell);
	// 		i++;
	// 	}
	// if (lastboardstr == data.board) {
	// 	for (let grp of [newPieces, removedPieces])
	// 		for (let arr of grp)
	// 			if (arr.length)
	// 				throw Error("same board but new ops needed");
	// }
	// lastboardstr = data.board;
	// for (let type = 0; type < 4; type++)
	// 	for (let i = newPieces[type].length; i < removedPieces[type].length; i++) {
	// 		// delete piece
	// 		const cell = removedPieces[type][i];
	// 		const piece = cell.piece;
	// 		piece.remove = true;
	// 		cell.piece.el.setAttribute("deleting", "");
	// 		window.requestAnimationFrame(_ => setTimeout(_ => piece.el.remove(), 250));
	// 		cell.piece = undefined;
	// 	}
	// for (let type = 0; type < 4; type++) {
	// 	let i = 0;
	// 	for (; i < Math.min(newPieces[type].length, removedPieces[type].length); i++) {
	// 		// move piece
	// 		const toCell = newPieces[type][i];
	// 		const fromCell = removedPieces[type][i];
	// 		const piece = fromCell.piece;
	// 		toCell.piece = piece;
	// 		fromCell.piece = undefined;
	// 		piece.x = toCell.x;
	// 		piece.y = toCell.y;
	// 		piece.el.style.setProperty("--x", toCell.x);
	// 		piece.el.style.setProperty("--y", toCell.y);
	// 		piece.el.removeAttribute("unmoved");
	// 		piece.el.setAttribute("moving", "");
	// 		setTimeout(_ => piece.el.removeAttribute("moving"));
	// 	}
	// 	for (; i < newPieces[type].length; i++) {
	// 		continue;
	// 		// create piece
	// 		const cell = newPieces[type][i];
	// 		const piece = {
	// 			el: document.createElement("game-piece"),
	// 			value: type + 1,
	// 			x: cell.x,
	// 			y: cell.y,
	// 		};
	// 		cell.piece = piece;
	// 		let side = type < 2 ? "blue" : "red";
	// 		if (type % 2 == 1)
	// 			piece.el.setAttribute("master", "");
	// 		piece.el.style.setProperty("--x", cell.x);
	// 		piece.el.style.setProperty("--y", cell.y);
	// 		gameBoard.el.append(piece.el);
	// 		if (data.moves.length) {
	// 			piece.el.setAttribute(side, "");
	// 			if ((side == "blue" ? 0 : 5) == cell.y)
	// 				piece.el.setAttribute("unmoved", "");
	// 			piece.el.style.setProperty("opacity", 0);
	// 			window.requestAnimationFrame(_ => window.requestAnimationFrame(_ => piece.el.style.setProperty("opacity", 1)));
	// 		} else
	// 			window.requestAnimationFrame(_ => window.requestAnimationFrame(_ => piece.el.setAttribute(side, "")));
	// 		piece.el.onclick = e => {
	// 			if (selectedCell)
	// 				return;
	// 			piece.el.onmouseenter();
	// 			selectedCell = cell;
	// 			e.stopPropagation();
	// 		}
	// 		piece.el.onmouseenter = _ => {
	// 			if (selectedCell || piece.removed)
	// 				return;
	// 			removeHighlights();
	// 			let allUsableCards = [];
	// 			for (let i = 0; i < 25; i++) {
	// 				const y = piece.y - Math.floor(i / 5) + 2;
	// 				const x = piece.x + (i % 5) - 2;
	// 				if (x < 0 || x >= 5 || y < 0 || y >= 5)
	// 					continue;
	// 				if (gameBoard.cells[y][x].piece && ((gameBoard.cells[y][x].piece.value <= 2) == (piece.value <= 2)))
	// 					continue;
	// 				let usableCards = [];
	// 				for (let j = 0; j < currentCards.length; j++) {
	// 					const card = currentCards[j];
	// 					if (card.moves[((piece.value <= 2) != inverted) ? i : 24 - i] == '1') {
	// 						usableCards.push(j);
	// 						if (allUsableCards.indexOf(j) == -1)
	// 							allUsableCards.push(j);
	// 						card.el.setAttribute("highlighted", "");
	// 						continue;
	// 					}
	// 				}
	// 				if (!usableCards.length)
	// 					continue;
	// 				let highlightEl = document.createElement("game-ghost-piece");
	// 				if (type % 2 == 1)
	// 					highlightEl.setAttribute("master", "");
	// 				highlightEl.style.setProperty("--x", x);
	// 				highlightEl.style.setProperty("--y", y);
	// 				gameBoard.el.append(highlightEl);
	// 				highlights.push(highlightEl);
	// 				highlightEl.onmouseover = _ => {
	// 					for (let j of allUsableCards)
	// 						if (usableCards.indexOf(j) == -1)
	// 							currentCards[j].el.removeAttribute("highlighted");
	// 						else {
	// 							currentCards[j].el.setAttribute("highlighted-individual", "");
	// 							currentCards[j].gridEl.children[(piece.value <= 2) != inverted ? i : 24 - i].setAttribute("highlighted", "");
	// 						}
	// 				};
	// 				highlightEl.onmouseleave = _ => {
	// 					if (cardChoiceOverlay.hasAttribute("visible"))
	// 						return;
	// 					for (let j of allUsableCards)
	// 						currentCards[j].el.setAttribute("highlighted", "");
	// 					for (let j of usableCards) {
	// 						currentCards[j].el.removeAttribute("highlighted-individual");
	// 						currentCards[j].gridEl.children[(piece.value <= 2) != inverted ? i : 24 - i].removeAttribute("highlighted");
	// 					}
	// 				};
	// 				highlightEl.onclick = _ => {
	// 					if (piece.removed)
	// 						return;
							
	// 					const submitMove = cardChoice => {
	// 						const card = currentCards[usableCards[cardChoice]];
	// 						const pos = "edcba"[piece.x] + (piece.y+1) + "edcba"[x] + (y+1);
	// 						ws.send("move " + latestData.matchId + " " + localStorage["match-" + latestData.matchId].substr(1) + " " + card.name + " " + pos);
	// 						let predictedBoard = latestData.board.split("");
	// 						predictedBoard[x + 5 * y] = predictedBoard[piece.x + 5 * piece.y];
	// 						predictedBoard[piece.x + 5 * piece.y] = '0';
	// 						let predictedCards = latestData.cards;
	// 						let lastSideCard = latestData.cards.side;
	// 						predictedCards.side = latestData.cards[latestData.currentTurn][usableCards[cardChoice]];
	// 						predictedCards[latestData.currentTurn][usableCards[cardChoice]] = lastSideCard;
	// 						setBoard({
	// 							gameState: latestData.gameState,
	// 							matchId: latestData.matchId,
	// 							currentTurn: latestData.currentTurn == "red" ? "blue" : "red",
	// 							startingCards: latestData.startingCards,
	// 							moves: latestData.moves.concat([card.name + ":" + pos]),
	// 							winner: "none",
	// 							board: predictedBoard.join(""),
	// 							cards: predictedCards,
	// 							indices: latestData.indices,
	// 						});
	// 					};

	// 					selectedCell = undefined;
	// 					if (usableCards.length > 1) {
	// 						cardChoiceOverlay.setAttribute("visible", "");
	// 						for (let j of usableCards) {
	// 							const card = currentCards[j];
	// 							card.el.onclick = _ => {
	// 								for (let j of usableCards)
	// 									currentCards[j].el.onclick = undefined;
	// 								cardChoiceOverlay.removeAttribute("visible");
	// 								submitMove(j);
	// 							};
	// 						}
	// 						for (let highlight of highlights)
	// 							if (highlight != highlightEl)
	// 								highlight.remove();
	// 						highlights = [highlightEl];
	// 					} else
	// 						submitMove(0);
	// 				};
	// 			}
	// 		};
	// 		piece.el.onmouseleave = removeHighlights;
	// 	}
	// }
}


let subscribed = false;
let spectateOnly = false;
ws.onerror = initialiseMainPage;
ws.onmessage = e => {
	const data = JSON.parse(e.data);
	console.log("recv", data);
	let playerIndex = 1;
	switch(data.messageType) {
	case "state":
		lastMatchId = data.matchId;
		let joining = false;
		switch(data.gameState) {
		case "waiting for player":
			if (localStorage["match-" + data.matchId] || spectateOnly) {
				container.setAttribute("waiting-opponent", "");
				if (localStorage["match-" + data.matchId]) {
					redNameEl.innerText = data.usernames.red;
					container.setAttribute("playable", "");
					copyToClipboard(data.matchId);
				} else {
					blueNameEl.innerText = data.usernames.blue;
					waitingEl.onclick = e => {
						ws.send("join " + data.matchId + " " + localStorage.username);
					};
				}
			} else {
				requestUsername();
				ws.send("join " + data.matchId + " " + localStorage.username);
			}
			break;
		case "in progress":
			if (localStorage["match-" + data.matchId])
					container.setAttribute("playable", data.indices.blue == parseInt(localStorage["match-" + data.matchId][0]) ? "blue" : "red");
			container.removeAttribute("waiting-opponent");
		case "ended":
			data.board = data.board.match(/.{1,5}/g).map(x => x.split('').reverse().join('')).join('');
			setBoard(data);
			break;
		}
		break;
	case "spectate":
	case "move":
		break;
	case "create":
		copyToClipboard(data.matchId);
		ws.send("spectate " + data.matchId);
		playerIndex = 0;
	case "join":
		localStorage["match-" + data.matchId] = playerIndex + data.token;
		if (window.location.hash.length < 1)
			history.replaceState(undefined, undefined, window.location.pathname + "#" + data.matchId);
		else
			history.pushState(undefined, undefined, window.location.pathname + "#" + data.matchId);
		lastMatchId = data.matchId;
		break;
	case "error":
		if (data.command == "spectate" && data.error == "Game ended")
			return ws.send("state " + data.matchId);
	default:
		console.error(data);
		if (data.command == "state" || data.command == "spectate") {
			delete localStorage["match-" + match[1]];
			initialiseMainPage();
		}
		throw Error();
	}
};
window.onpopstate = history.onpushstate = _ => {
	const match = document.location.hash.match(/^#(spectate-)?([0-9a-f]+)$/i);
	if (match) {
		if (lastMatchId && (match[2] != lastMatchId) || spectateOnly != !!match[1])
			window.location.reload();
		spectateOnly = !!match[1];
	} else if (lastMatchId)
		window.location.reload();
};

const _send = ws.send;
ws.send = s => {
	console.log("send", s);
	_send.bind(ws)(s);
}

const match = document.location.hash.match(/^#?(spectate-)?([0-9a-f]+)$/i);
if (match) {
	spectateOnly = !!match[1];
	ws.onopen = _ => {
		ws.send("spectate " + match[2]);
	};
	ws.onclose = _ => setTimeout(_ => window.location.reload(), 1000);
} else
	ws.onopen = _ => initialiseMainPage();


function requestUsername() {
	while (!localStorage.username || !localStorage.username.length)
		localStorage.username = prompt("enter a username");
}
function initialiseMainPage() {
	removeHighlights();
	if (lastMatchId) {
		history.pushState(undefined, undefined, window.location.pathname);
		window.location.reload();
	}
	requestUsername();
	ws.send("create " + localStorage.username);
}


const toastQueue = [];
function copyToClipboard(value) {
	value = "https://git.io/onitama#" + value;
	container.onclick = _ => {
		if (!container.hasAttribute("waiting-opponent"))
			return;
		if (toastQueue.length)
			return;

		const copyBox = document.getElementById("copyTextBox");
		copyBox.value = value;
		copyBox.focus();
		copyBox.select();
		let successful = false;
		try {
			successful = document.execCommand('copy');
		} catch (err) {}
		if (successful) {
			displayToast("Copied invite link to clipboard");
		} else {
			displayToast("Copying failed");
			console.error("copying failed");
		}
	};
}

function displayToast(message) {
	const displayNextToast = _ => {
		const el = document.createElement("toast-notification");
		el.innerText = toastQueue[0];
		document.body.append(el);
		window.requestAnimationFrame(_ => {
			const next = _ => {
				toastQueue.shift();
				if (toastQueue.length)
					displayNextToast();
				el.removeAttribute("visible", "");
				window.requestAnimationFrame(_ => setTimeout(_ => el.remove(), 500));
			};
			el.setAttribute("visible", "");
			const timer = setTimeout(next, 4000);
			el.onclick = _ => {
				clearTimeout(timer);
				next();
			};
		});
	};
	if (toastQueue.push(message) == 1)
		displayNextToast();
}