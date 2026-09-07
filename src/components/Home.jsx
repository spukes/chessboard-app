import React, { useState } from 'react';
import './Home.css';

export default function Home({ onJoinClass }) {
    const [roomIdInput, setRoomIdInput] = useState('');

    const handleCreate = () => {
        onJoinClass('CREATE', null);
    };

    const handleJoin = (e) => {
        e.preventDefault();
        if (roomIdInput.trim()) {
            onJoinClass('JOIN', roomIdInput.trim());
        }
    };

    return (
        <div className="home-container">
            <div className="home-box">
                <h1>♟️ Aula de Ajedrez Mágica ♟️</h1>
                <p>Aprende y diviértete jugando al ajedrez</p>

                <div className="home-actions">
                    <div className="action-card teacher-card">
                        <h2>Para Profesores</h2>
                        <p>Haz clic abajo para crear un tablero nuevo y generar unas palabras secretas.</p>
                        <button className="btn-create" onClick={handleCreate}>✨ Crear Clase Nueva</button>
                    </div>

                    <div className="action-card student-card">
                        <h2>Para Alumnos</h2>
                        <p>Escribe aquí las palabras secretas que te dio tu profesor.</p>
                        <form onSubmit={handleJoin} className="join-form">
                            <input
                                type="text"
                                placeholder="ej: gato-rojo-feliz"
                                value={roomIdInput}
                                onChange={(e) => setRoomIdInput(e.target.value)}
                            />
                            <button type="submit" className="btn-join">🚀 Unirse a la Clase</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
