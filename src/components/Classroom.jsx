import React, { useState, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { socket } from '../App';
import './Classroom.css';

export default function Classroom({ roomData, onLeave }) {
    const { roomId, isTeacher, state } = roomData;
    const [chess] = useState(new Chess(state.fen !== 'start' ? state.fen : undefined));
    const [fen, setFen] = useState(chess.fen());
    const [boardOrientation, setBoardOrientation] = useState(isTeacher ? 'black' : 'white');
    const [darkMode, setDarkMode] = useState(true);
    const [boardKey, setBoardKey] = useState(0);

    // Decorations
    const [remoteArrows, setRemoteArrows] = useState([]);
    const [squares, setSquares] = useState(state.squares || {});

    // References
    const boardRef = useRef(null);

    // Styling
    const [boardTint, setBoardTint] = useState('#b58863');

    // Helper to load any FEN without chess.js strict validation crash
    const loadIllegalFen = (chessInstance, fenString) => {
        chessInstance.clear();
        if (fenString.startsWith('8/8/8/8/8/8/8/8')) return; // empty board
        const rows = fenString.split(' ')[0].split('/');
        for (let r = 0; r < 8; r++) {
            let col = 0;
            for (let c = 0; c < rows[r].length; c++) {
                const char = rows[r][c];
                if (isNaN(char)) {
                    chessInstance.put(
                        { type: char.toLowerCase(), color: char === char.toUpperCase() ? 'w' : 'b' },
                        `${String.fromCharCode(97 + col)}${8 - r}`
                    );
                    col++;
                } else {
                    col += parseInt(char);
                }
            }
        }
    };

    useEffect(() => {
        socket.on('opponent_move', ({ fen: newFen }) => {
            loadIllegalFen(chess, newFen);
            setFen(newFen);
        });

        socket.on('fen_updated', (newFen) => {
            loadIllegalFen(chess, newFen);
            setFen(newFen);
        });

        socket.on('arrows_synced', (syncedArrows) => {
            setRemoteArrows(syncedArrows);
        });

        socket.on('squares_synced', (syncedSquares) => {
            setSquares(syncedSquares);
        });

        socket.on('decorations_cleared', () => {
            setRemoteArrows([]);
            setSquares({});
            setBoardKey(k => k + 1);
        });

        return () => {
            socket.off('opponent_move');
            socket.off('fen_updated');
            socket.off('arrows_synced');
            socket.off('squares_synced');
            socket.off('decorations_cleared');
        };
    }, [chess]);

    const onDrop = (sourceSquare, targetSquare) => {
        const sourcePiece = chess.get(sourceSquare);
        const targetPiece = chess.get(targetSquare);

        if (!sourcePiece) return false;

        // Protect the King and Same Color
        if (targetPiece) {
            if (targetPiece.type === 'k') return false;
            if (targetPiece.color === sourcePiece.color) return false;
        }

        if (targetPiece) {
            chess.remove(targetSquare);
        }

        chess.remove(sourceSquare);
        chess.put(sourcePiece, targetSquare);

        const newFen = chess.fen();
        setFen(newFen);
        socket.emit('update_fen', { roomId, fen: newFen });
        return true;
    };

    const onSparePieceDrop = (piece, targetSquare) => {
        // Protect replacing king with a spare piece
        const targetPiece = chess.get(targetSquare);
        if (targetPiece && targetPiece.type === 'k') return false;

        if (targetPiece) chess.remove(targetSquare);

        const color = piece[0] === 'w' ? 'w' : 'b';
        const type = piece[1].toLowerCase();
        chess.put({ type, color }, targetSquare);

        const newFen = chess.fen();
        setFen(newFen);
        socket.emit('update_fen', { roomId, fen: newFen });
        handleClearDecorations();
        return true;
    };

    const onPieceDropOffBoard = (sourceSquare) => {
        chess.remove(sourceSquare);
        const newFen = chess.fen();
        setFen(newFen);
        socket.emit('update_fen', { roomId, fen: newFen });
    };

    const handleNativeDrop = (e) => {
        const pieceId = e.dataTransfer.getData("piece"); // e.g., 'wP'
        if (!pieceId || !boardRef.current) return;
        e.preventDefault();

        const boardRect = boardRef.current.getBoundingClientRect();
        const x = e.clientX - boardRect.left;
        const y = e.clientY - boardRect.top;
        if (x < 0 || y < 0 || x > boardRect.width || y > boardRect.height) return;

        const squareSize = boardRect.width / 8;
        const fileIdx = Math.floor(x / squareSize);
        const rankIdx = Math.floor(y / squareSize);

        let file, rank;
        if (boardOrientation === 'white') {
            file = String.fromCharCode(97 + fileIdx);
            rank = 8 - rankIdx;
        } else {
            file = String.fromCharCode(104 - fileIdx);
            rank = 1 + rankIdx;
        }
        const targetSquare = `${file}${rank}`;

        const existing = chess.get(targetSquare);
        if (existing && existing.type === 'k') return;
        if (existing) chess.remove(targetSquare);

        chess.put({ type: pieceId[1].toLowerCase(), color: pieceId[0] }, targetSquare);
        const newFen = chess.fen();
        setFen(newFen);
        socket.emit('update_fen', { roomId, fen: newFen });
    };

    const onSquareRightClick = (square) => {
        const newSquares = { ...squares };
        if (newSquares[square]) {
            delete newSquares[square];
        } else {
            newSquares[square] = true;
        }
        setSquares(newSquares);
        socket.emit('sync_squares', { roomId, squares: newSquares });
    };

    const handleArrowsChange = (newArrows) => {
        socket.emit('sync_arrows', { roomId, arrows: newArrows });
    };

    const handleClearDecorations = () => {
        setRemoteArrows([]);
        setSquares({});
        setBoardKey(k => k + 1);
        socket.emit('clear_decorations', { roomId });
    };

    const customSquareStyles = {};
    Object.keys(squares).forEach((sq) => {
        customSquareStyles[sq] = { backgroundColor: 'rgba(255, 170, 0, 0.8)' };
    });

    const renderPiecePalette = () => {
        const pieces = ['wP', 'wN', 'wB', 'wR', 'wQ', 'wK', 'bP', 'bN', 'bB', 'bR', 'bQ', 'bK'];
        const pieceUrls = {
            wP: 'https://upload.wikimedia.org/wikipedia/commons/4/45/Chess_plt45.svg',
            wN: 'https://upload.wikimedia.org/wikipedia/commons/7/70/Chess_nlt45.svg',
            wB: 'https://upload.wikimedia.org/wikipedia/commons/b/b1/Chess_blt45.svg',
            wR: 'https://upload.wikimedia.org/wikipedia/commons/7/72/Chess_rlt45.svg',
            wQ: 'https://upload.wikimedia.org/wikipedia/commons/1/15/Chess_qlt45.svg',
            wK: 'https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg',
            bP: 'https://upload.wikimedia.org/wikipedia/commons/c/c7/Chess_pdt45.svg',
            bN: 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Chess_ndt45.svg',
            bB: 'https://upload.wikimedia.org/wikipedia/commons/9/98/Chess_bdt45.svg',
            bR: 'https://upload.wikimedia.org/wikipedia/commons/f/ff/Chess_rdt45.svg',
            bQ: 'https://upload.wikimedia.org/wikipedia/commons/4/47/Chess_qdt45.svg',
            bK: 'https://upload.wikimedia.org/wikipedia/commons/f/f0/Chess_kdt45.svg',
        };
        return (
            <div className="piece-palette">
                {pieces.map(p => (
                    <img key={p}
                        className="piece-img"
                        src={pieceUrls[p]}
                        draggable
                        onDragStart={(e) => {
                            e.dataTransfer.setData("piece", p);
                        }}
                        alt={p}
                    />
                ))}
            </div>
        );
    };

    const drawArrow = (sq1, sq2, key) => {
        const file1 = sq1.charCodeAt(0) - 97;
        const rank1 = 8 - parseInt(sq1[1]);
        const file2 = sq2.charCodeAt(0) - 97;
        const rank2 = 8 - parseInt(sq2[1]);

        let x1 = (file1 * 100) + 50;
        let y1 = (rank1 * 100) + 50;
        let x2 = (file2 * 100) + 50;
        let y2 = (rank2 * 100) + 50;

        if (boardOrientation === 'black') {
            x1 = 800 - x1; y1 = 800 - y1;
            x2 = 800 - x2; y2 = 800 - y2;
        }

        return (
            <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255, 170, 0, 0.8)" strokeWidth="15" markerEnd="url(#arrowhead)" strokeLinecap="round" opacity="0.8" />
        );
    }

    const renderRemoteArrows = () => {
        if (!remoteArrows || remoteArrows.length === 0) return null;
        return (
            <svg viewBox="0 0 800 800" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }}>
                <defs>
                    <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="4.5" refY="3" orient="auto">
                        <polygon points="0 0, 6 3, 0 6" fill="rgba(255, 170, 0, 0.8)" opacity="0.8" />
                    </marker>
                </defs>
                {remoteArrows.map((arrow, i) => drawArrow(arrow[0], arrow[1], i))}
            </svg>
        );
    };

    return (
        <div className={`classroom-container ${darkMode ? 'dark-mode' : 'light-mode'}`}>
            <div className="panel-area">
                <div className="panel-header">
                    <h2>Aula: {roomId}</h2>
                    <span className={`panel-badge ${isTeacher ? 'badge-teacher' : 'badge-student'}`}>
                        {isTeacher ? '👨‍🏫 Profesor' : '👦 Alumno'}
                    </span>
                </div>

                <div className="control-group">
                    <h3>Tema Global</h3>
                    <button className="control-btn btn-secondary" onClick={() => setDarkMode(!darkMode)}>
                        {darkMode ? '☀️ Cambiar a Claro' : '🌙 Cambiar a Oscuro'}
                    </button>
                </div>

                <div className="control-group">
                    <h3>Herramientas</h3>
                    <button className="control-btn btn-secondary" onClick={() => setBoardOrientation(boardOrientation === 'white' ? 'black' : 'white')}>
                        🔄 Girar Tablero
                    </button>
                    <button className="control-btn btn-danger" onClick={handleClearDecorations}>
                        🧹 Limpiar Dibujos
                    </button>
                    <button className="control-btn btn-secondary" onClick={() => {
                        chess.reset();
                        setFen(chess.fen());
                        socket.emit('update_fen', { roomId, fen: chess.fen() });
                    }}>♟️ Posición Inicial</button>
                    <button className="control-btn btn-danger" onClick={() => {
                        chess.clear();
                        setFen(chess.fen());
                        socket.emit('update_fen', { roomId, fen: chess.fen() });
                    }}>❌ Limpiar Todo</button>
                </div>

                <div className="control-group">
                    <h3>Aspecto</h3>
                    <span>Color del Tablero:</span>
                    <div className="colors-picker">
                        <div style={{ backgroundColor: '#b58863' }} onClick={() => setBoardTint('#b58863')}></div>
                        <div style={{ backgroundColor: '#779556' }} onClick={() => setBoardTint('#779556')}></div>
                        <div style={{ backgroundColor: '#769656' }} onClick={() => setBoardTint('#769656')}></div>
                        <div style={{ backgroundColor: '#4a7395' }} onClick={() => setBoardTint('#4a7395')}></div>
                    </div>
                </div>

                <button className="control-btn" onClick={onLeave} style={{ marginTop: 'auto', backgroundColor: '#555', color: 'white' }}>
                    Cerrar Clase
                </button>
            </div>

            <div className="board-area">
                <div
                    className="board-wrapper"
                    ref={boardRef}
                    onDropCapture={handleNativeDrop}
                    onDragOverCapture={e => e.preventDefault()}
                >
                    <p style={{ textAlign: "center", margin: 0, paddingBottom: 10, color: "#ccc", fontSize: "0.8rem" }}>Usa la paleta inferior para arrastrar piezas hacia el tablero, o arrástralas fuera del tablero para borrarlas.</p>
                    <div style={{ position: 'relative', width: '100%' }}>
                        <Chessboard
                            key={`chessboard-${boardKey}`}
                            id="BasicBoard"
                            position={fen}
                            onPieceDrop={onDrop}
                            dropOffBoardAction="trash"
                            onPieceDropOffBoard={onPieceDropOffBoard}
                            boardOrientation={boardOrientation}
                            customDarkSquareStyle={{ backgroundColor: boardTint }}
                            onArrowsChange={handleArrowsChange}
                            areArrowsAllowed={true}
                            onSquareRightClick={onSquareRightClick}
                            customSquareStyles={customSquareStyles}
                        />
                        {renderRemoteArrows()}
                    </div>
                    {renderPiecePalette()}
                </div>
            </div>

            <div className="panel-area right-panel">
                <div className="control-group">
                    <h3>Sobre esta clase</h3>
                    <p>Tablero libre de reglas para jugar, explicar variantes y pensar.</p>
                    <ul>
                        <li>El Rey no puede ser devorado.</li>
                        <li>Para borrar una pieza, arrástrala fuera.</li>
                        <li>Click derecho marca la casilla.</li>
                        <li>Si arrastras con click derecho se dibujan flechas.</li>
                    </ul>
                </div>
                <div className="control-group">
                    <h3>Posición / PGN</h3>
                    <button className="control-btn btn-primary" onClick={() => {
                        const url = window.prompt("Introduce FEN:");
                        if (url) {
                            try { chess.load(url); } catch (e) { }
                            setFen(chess.fen());
                            socket.emit('update_fen', { roomId, fen: chess.fen() });
                        }
                    }}>📥 Importar FEN</button>
                    <button className="control-btn btn-secondary" onClick={() => {
                        window.prompt("Copia este PGN/FEN:", chess.fen());
                    }}>📤 Exportar Posición</button>
                </div>
            </div>
        </div>
    );
}
