// src/pages/student/StudentAnnouncements.jsx

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Megaphone, Link as LinkIcon, User, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeToClassAnnouncements } from '../../firebase/services';
import Navbar from '../../components/common/Navbar';
import Card from '../../components/common/Card';
import Loading from '../../components/common/Loading';
import toast from 'react-hot-toast';

const StudentAnnouncements = () => {
  const { currentUser } = useAuth();
  const [groupedAnnouncements, setGroupedAnnouncements] = useState({});
  const [loading, setLoading] = useState(true);
  const [expandedTeachers, setExpandedTeachers] = useState({});

  useEffect(() => {
    localStorage.setItem('announcementLastVisited', Date.now());
  }, []);

  // Realtime: a new announcement appears the instant a teacher posts it.
  // The cached copy renders first so there is no spinner on revisit, and the
  // listener resumes from Firestore's persistent cache, so re-entering this
  // page downloads only what actually changed.
  useEffect(() => {
    if (!currentUser?.classId) {
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeToClassAnnouncements(
          currentUser.classId,
          (data) => {
            processAnnouncements(data);
            setLoading(false);
            // ✅ REMOVED: localStorage.setItem('announcementLastVisited', Date.now().toString());
            // This was hiding the navbar red dot instantly. It should only be set on page mount.
          },
          () => {
            toast.error('Failed to load announcements');
            setLoading(false);
          }
        );

    return () => unsubscribe();
  }, [currentUser?.classId]);

  const processAnnouncements = (data) => {
    // ✅ Group by "teacherName|||subjectName" so each teacher+subject combo is separate
    const grouped = data.reduce((acc, ann) => {
      const teacher = ann.teacherName || 'Unknown Teacher';
      const subject = ann.subjectName || '';
      const groupKey = `${teacher}|||${subject}`;
      if (!acc[groupKey]) acc[groupKey] = [];
      acc[groupKey].push(ann);
      return acc;
    }, {});

    setGroupedAnnouncements(grouped);

    // ✅ Default: all collapsed
    const collapsed = {};
    Object.keys(grouped).forEach(key => {
      collapsed[key] = false;
    });
    setExpandedTeachers(collapsed);
  };

  const toggleTeacher = (key) => {
    setExpandedTeachers(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  if (loading) return <Loading />;
  const groupKeys = Object.keys(groupedAnnouncements);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link to="/student/dashboard" className="inline-flex items-center text-gray-600 hover:text-gray-800 mb-2 text-sm">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Megaphone className="w-6 h-6 text-purple-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Announcements</h1>
              <p className="text-gray-600 text-sm truncate">Class: {currentUser?.className}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-green-50 text-green-700 rounded-full text-[11px] font-medium shrink-0">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
              </span>
              Live
            </span>
          </div>
        </div>

        {groupKeys.length === 0 ? (
          <Card className="text-center py-12">
            <Megaphone className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-800 mb-1">No Announcements</h3>
            <p className="text-gray-500">Your teachers haven't posted anything yet.</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {groupKeys.map((groupKey) => {
              const isExpanded = expandedTeachers[groupKey] === true;
              const count = groupedAnnouncements[groupKey].length;
              const [teacherName, subjectName] = groupKey.split('|||');

              return (
                <Card key={groupKey} className="p-0 overflow-hidden">
                  <button
                    onClick={() => toggleTeacher(groupKey)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div className="text-left min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-sm sm:text-base font-bold text-gray-800">{teacherName}</h2>
                          {subjectName && (
                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[11px] font-medium">{subjectName}</span>
                          )}
                        </div>
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
                      {groupedAnnouncements[groupKey].map(ann => (
                        <div key={ann.id} className="px-4 py-3 hover:bg-gray-50/50 transition-colors">
                          <div className="flex items-start gap-3">
                            <div className="p-1.5 bg-purple-50 rounded-lg mt-0.5 flex-shrink-0">
                              <Megaphone className="w-3.5 h-3.5 text-purple-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-0.5 sm:gap-2">
                                <h3 className="font-bold text-gray-800 text-sm sm:text-base">{ann.title}</h3>
                                <span className="text-[11px] text-gray-400 whitespace-nowrap flex-shrink-0">{formatDate(ann.createdAt)}</span>
                              </div>
                              <p className="text-gray-600 text-sm my-1.5 whitespace-pre-wrap break-words">{ann.content}</p>
                              {ann.link && (
                                <a href={ann.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline text-sm">
                                  <LinkIcon className="w-3.5 h-3.5" /> Open Link
                                </a>
                              )}
                            </div>
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

export default StudentAnnouncements;
