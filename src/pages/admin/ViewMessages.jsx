// src/pages/admin/ViewMessages.jsx

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, CheckCircle } from 'lucide-react';
import { getContactMessages, markMessageRead } from '../../firebase/services';
import Navbar from '../../components/common/Navbar';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Loading from '../../components/common/Loading';
import toast from 'react-hot-toast';

const ViewMessages = () => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const res = await getContactMessages();
    if(res.success) setMessages(res.data);
    setLoading(false);
  };

  const handleMarkRead = async (id) => {
    try {
        await markMessageRead(id);
        // Update local state immediately
        setMessages(prev => prev.map(m => m.id === id ? {...m, read: true} : m));
        toast.success("Marked as read");
    } catch (err) {
        console.error(err);
        toast.error("Failed to update. Check Rules.");
    }
  };

  if(loading) return <Loading />;

  return (
    <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 py-8">
            <Link to="/admin/dashboard" className="inline-flex items-center text-gray-600 mb-4"><ArrowLeft className="w-4 h-4 mr-1"/> Back</Link>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">User Messages</h1>
            </div>

            {messages.length === 0 ? (
                <Card className="text-center py-12">
                    <Mail className="w-12 h-12 text-gray-300 mx-auto mb-2"/>
                    <p className="text-gray-500">No messages yet.</p>
                </Card>
            ) : (
                <div className="space-y-3">
                    {messages.map(msg => (
                        <Card key={msg.id} className={`p-4 ${!msg.read ? 'bg-blue-50 border-blue-200' : 'bg-white'}`}>
                            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                                <div className="flex gap-3">
                                    <div className="p-2 bg-gray-100 rounded-full h-fit">
                                        <Mail className={`w-5 h-5 ${!msg.read ? 'text-blue-600' : 'text-gray-400'}`}/>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="font-bold text-gray-800">{msg.name}</p>
                                            {!msg.read && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">New</span>}
                                        </div>
                                        <p className="text-xs text-gray-500 mb-2">{msg.email} • {msg.createdAt?.toDate().toLocaleString()}</p>
                                        <p className="text-gray-700 text-sm">{msg.message}</p>
                                    </div>
                                </div>
                                <div className="flex-shrink-0 self-end sm:self-start">
                                    {!msg.read && (
                                        <Button size="sm" variant="secondary" icon={CheckCircle} onClick={() => handleMarkRead(msg.id)}>
                                            Read
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </main>
    </div>
  );
};

export default ViewMessages;