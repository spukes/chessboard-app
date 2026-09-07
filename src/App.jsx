import { useState } from 'react'
import io from 'socket.io-client'
import Home from './components/Home'
import Classroom from './components/Classroom'

// Connect to the same host if in prod, otherwise localhost:3001
export const socket = io(import.meta.env.PROD ? '/' : 'http://localhost:3001');

function App() {
    const [view, setView] = useState('HOME'); // HOME | CLASSROOM
    const [roomData, setRoomData] = useState(null);

    const handleJoinClass = (action, roomId) => {
        if (action === 'CREATE') {
            socket.emit('create_room', (res) => {
                setRoomData(res);
                setView('CLASSROOM');
            });
        } else if (action === 'JOIN') {
            socket.emit('join_room', roomId, (res) => {
                if (res.success) {
                    setRoomData({ roomId, isTeacher: false, state: res.state });
                    setView('CLASSROOM');
                } else {
                    alert('Error: ' + res.error);
                }
            });
        }
    };

    const handleLeaveClass = () => {
        setView('HOME');
        setRoomData(null);
        socket.emit('leave_room'); // We can just reload or let disconnect handle it
        window.location.reload();
    };

    return (
        <div className="app-main">
            {view === 'HOME' && <Home onJoinClass={handleJoinClass} />}
            {view === 'CLASSROOM' && (
                <Classroom roomData={roomData} onLeave={handleLeaveClass} />
            )}
        </div>
    )
}

export default App
