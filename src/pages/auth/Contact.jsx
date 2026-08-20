import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Mail, User } from 'lucide-react';
import { submitContactForm } from '../../firebase/services';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import toast from 'react-hot-toast';

const Contact = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if(!formData.name || !formData.email || !formData.message) {
        toast.error("Please fill all fields");
        return;
    }
    setLoading(true);
    const res = await submitContactForm(formData);
    if(res.success) {
        toast.success("Message sent successfully!");
        setFormData({ name: '', email: '', message: '' });
        // Redirect to home page after 1 second
        setTimeout(() => {
          navigate('/');
        }, 1000);
    } else {
        toast.error("Failed to send message");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md">
            <Link to="/" className="inline-flex items-center text-gray-600 hover:text-gray-800 mb-4 text-sm transition-colors">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back to Role Selection
            </Link>
            <Card className="p-6">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Mail className="w-8 h-8 text-blue-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800">Contact Us</h2>
                    <p className="text-gray-500 text-sm mt-1">Facing issues? Let us know.</p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input 
                        label="Name" 
                        value={formData.name} 
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        placeholder="Your Name"
                        icon={User}
                        required
                    />
                    <Input 
                        label="Email" 
                        type="email"
                        value={formData.email} 
                        onChange={e => setFormData({...formData, email: e.target.value})}
                        placeholder="your@email.com"
                        icon={Mail}
                        required
                    />
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                        <textarea 
                            rows={4}
                            value={formData.message}
                            onChange={e => setFormData({...formData, message: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none transition-all"
                            placeholder="Describe your problem..."
                            required
                        />
                    </div>
                    <Button type="submit" loading={loading} icon={Send} fullWidth>
                        Send Message
                    </Button>
                </form>
            </Card>
        </div>
    </div>
  );
};

export default Contact;