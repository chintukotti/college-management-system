// src/pages/teacher/TeacherAnnouncements.jsx

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Megaphone, Trash2, Link as LinkIcon, Send, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getSubjectsByTeacher, createAnnouncement, getAnnouncementsByTeacher, deleteAnnouncement } from '../../firebase/services';
import Navbar from '../../components/common/Navbar';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Loading from '../../components/common/Loading';
import toast from 'react-hot-toast';
import { getTodayDate } from '../../utils/helpers';

const TeacherAnnouncements = () => {
  const { currentUser } = useAuth();
  
  // Data for Dropdowns
  const [semesterGroups, setSemesterGroups] = useState([]); // Groups: E2, E3
  const [individualClasses, setIndividualClasses] = useState([]); // Individual: CSE 2A, CSE 3B
  
  // Data for History
  const [previousAnnouncements, setPreviousAnnouncements] = useState({});
  const [expandedClasses, setExpandedClasses] = useState({});

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    targetId: '', // Format: "sem_ID" or "cls_ID"
    title: '',
    content: '',
    link: ''
  });

  useEffect(() => {
    fetchData();
  }, [currentUser]);

  const fetchData = async () => {
    if(!currentUser) return;
    
    const subRes = await getSubjectsByTeacher(currentUser.uid);
    if (subRes.success) {
      // --- 1. Process Logic for Dropdowns ---
      const semMap = new Map(); // Unique Semesters
      const classMap = new Map(); // Unique Classes

      (subRes.data || []).forEach(sub => {
        // A. Build Semester Groups
        if (sub.semesterId) {
          if (!semMap.has(sub.semesterId)) {
            semMap.set(sub.semesterId, {
              id: sub.semesterId,
              name: sub.semesterName || 'Unknown Semester',
              classes: []
            });
          }
        }

        // B. Build Individual Classes List
        (sub.classes || []).forEach(cls => {
          // Add to ClassMap (Unique)
          if (!classMap.has(cls.classId)) {
            classMap.set(cls.classId, {
              ...cls,
              semesterId: sub.semesterId,
              semesterName: sub.semesterName
            });
          }

          // Add to Semester Group
          if (sub.semesterId) {
            const sem = semMap.get(sub.semesterId);
            // Check if class already in group to avoid duplicates
            if (sem && !sem.classes.find(c => c.classId === cls.classId)) {
              sem.classes.push(cls);
            }
          }
        });
      });

      setSemesterGroups(Array.from(semMap.values()));
      setIndividualClasses(Array.from(classMap.values()));
    }

    // --- 2. Fetch Previous Announcements ---
    const annRes = await getAnnouncementsByTeacher(currentUser.uid);
    if (annRes.success) {
      const sorted = annRes.data.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });

      // Group by ClassName for display
      const grouped = sorted.reduce((acc, ann) => {
        const cls = ann.className || 'Unknown Class';
        if (!acc[cls]) acc[cls] = [];
        acc[cls].push(ann);
        return acc;
      }, {});

      setPreviousAnnouncements(grouped);

      // Initialize all classes as collapsed by default
      const collapsed = {};
      Object.keys(grouped).forEach(cls => {
        collapsed[cls] = false;
      });
      setExpandedClasses(collapsed);
    }
    setLoading(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleClass = (clsName) => {
    setExpandedClasses(prev => ({
      ...prev,
      [clsName]: !prev[clsName]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.targetId || !formData.title || !formData.content) {
      toast.error('Please select a target and fill all fields');
      return;
    }

    setSubmitting(true);

    try {
      let classesToPost = [];
      const [type, id] = formData.targetId.split('_'); // e.g., "sem_123" or "cls_456"

      if (type === 'sem') {
        // Find Semester Group
        const group = semesterGroups.find(g => g.id === id);
        if (group) classesToPost = group.classes;
      } else if (type === 'cls') {
        // Find Individual Class
        const cls = individualClasses.find(c => c.classId === id);
        if (cls) classesToPost = [cls];
      }

      if (classesToPost.length === 0) {
        toast.error("No classes found for this selection.");
        setSubmitting(false);
        return;
      }

      // Post to determined classes
      const promises = classesToPost.map(cls => 
        createAnnouncement({
          classId: cls.classId,
          className: cls.className,
          title: formData.title,
          content: formData.content,
          link: formData.link,
          teacherId: currentUser.uid,
          teacherName: currentUser.name,
          date: getTodayDate()
        })
      );

      await Promise.all(promises);
      
      const targetName = type === 'sem' 
        ? semesterGroups.find(g=>g.id===id)?.name 
        : individualClasses.find(c=>c.classId===id)?.className;

      toast.success(`Posted to ${classesToPost.length} class(es) in ${targetName}!`);
      
      setFormData({ targetId: '', title: '', content: '', link: '' });
      fetchData(); 
    } catch (err) {
      toast.error(err.message || 'Failed to post');
    }
    
    setSubmitting(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this announcement?')) return;
    const result = await deleteAnnouncement(id);
    if (result.success) {
      toast.success('Deleted');
      const newGrouped = {...previousAnnouncements};
      for (let key in newGrouped) {
        newGrouped[key] = newGrouped[key].filter(a => a.id !== id);
      }
      setPreviousAnnouncements(newGrouped);
    } else toast.error('Failed to delete');
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return <Loading />;
  const classNames = Object.keys(previousAnnouncements);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <Link to="/teacher/dashboard" className="inline-flex items-center text-gray-600 hover:text-gray-800 mb-6">
          <ArrowLeft className="w-5 h-5 mr-2" /> Back
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-blue-100 rounded-lg"><Megaphone className="w-6 h-6 text-blue-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Announcements</h1>
            <p className="text-gray-600 text-sm">Post to Semester Groups or Individual Classes</p>
          </div>
        </div>

        {/* Create Form */}
        <Card className="mb-8">
          <h2 className="font-semibold text-gray-800 mb-4">Create New Announcement</h2>
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Target</label>
              <select
                name="targetId"
                value={formData.targetId}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Select Group or Class --</option>
                
                {/* Group 1: Semesters */}
                <optgroup label="📢 Semester Groups (Broadcast)">
                  {semesterGroups.map(group => (
                    <option key={`sem_${group.id}`} value={`sem_${group.id}`}>
                      {group.name} ({group.classes.length} classes)
                    </option>
                  ))}
                </optgroup>

                {/* Group 2: Individual Classes */}
                <optgroup label="🏫 Individual Classes">
                  {individualClasses.map(cls => (
                    <option key={`cls_${cls.classId}`} value={`cls_${cls.classId}`}>
                      {cls.className} ({cls.semesterName || 'No Sem'})
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <Input label="Title" name="title" value={formData.title} onChange={handleChange} placeholder="e.g., Exam Schedule" required />
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
              <textarea name="content" value={formData.content} onChange={handleChange} rows={3} required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Write your announcement here..." />
            </div>

            <Input label="Link (Optional)" name="link" value={formData.link} onChange={handleChange} placeholder="https://..." icon={LinkIcon} />

            <Button type="submit" loading={submitting} icon={Send}>
              Post Announcement
            </Button>
          </form>
        </Card>

        {/* Previous Announcements */}
        <h2 className="font-semibold text-gray-800 mb-4">Your Previous Announcements</h2>
        
        {classNames.length === 0 ? (
          <Card className="text-center py-8">
            <Megaphone className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500">No announcements posted yet.</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {classNames.map((clsName) => {
              const isExpanded = expandedClasses[clsName] === true;
              const count = previousAnnouncements[clsName].length;

              return (
                <Card key={clsName} className="p-0 overflow-hidden">
                  <button
                    onClick={() => toggleClass(clsName)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Users className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <div className="text-left">
                        <h2 className="text-sm sm:text-base font-bold text-gray-800">{clsName}</h2>
                        <p className="text-xs text-gray-400">{count} announcement{count !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    {isExpanded
                      ? <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      : <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    }
                  </button>

                  {isExpanded && (
                    <div className="divide-y divide-gray-100">
                      {previousAnnouncements[clsName].map(ann => (
                        <div key={ann.id} className="px-4 py-3 hover:bg-gray-50/50 transition-colors">
                          <div className="flex justify-between items-start">
                            <div className="flex-1 pr-4">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs text-gray-400">{formatDate(ann.createdAt)}</span>
                              </div>
                              <h3 className="font-bold text-gray-800">{ann.title}</h3>
                              <p className="text-gray-600 text-sm mt-1 whitespace-pre-wrap break-words">{ann.content}</p>
                              {ann.link && (
                                <a href={ann.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline text-sm mt-2 break-all">
                                  <LinkIcon className="w-4 h-4" /> View Resource
                                </a>
                              )}
                            </div>
                            <Button variant="danger" size="sm" icon={Trash2} onClick={() => handleDelete(ann.id)} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default TeacherAnnouncements;