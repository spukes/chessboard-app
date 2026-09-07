import { useState } from 'react'
import io from 'socket.io-client'
import Home from './components/Home'
import Classroom from './components/Classroom'

// Connect directly to Render Cloud backend everywhere
export const socket = io('https://chessboard-server-0voc.onrender.com');

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
