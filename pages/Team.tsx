import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

const Team: React.FC = () => {
  const navigate = useNavigate();
  const [team, setTeam] = useState<any[]>([]);
  const [projectsCount, setProjectsCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTeamAndProjects = async () => {
      setIsLoading(true);
      try {
        const [usersRes, projRes] = await Promise.all([
          api.users.list().catch(() => ({ status: 'error', data: [] })),
          api.projects.list().catch(() => ({ status: 'error', data: [] }))
        ]);

        const projects = Array.isArray(projRes?.data) ? projRes.data : [];
        setProjectsCount(projects.length);

        if (usersRes.status === 'success' && Array.isArray(usersRes.data)) {
          const activeOnly = usersRes.data
            .filter((u: any) => u.status === 'active')
            .map((u: any) => {
              const assignedProjects = projects.filter(
                (p: any) =>
                  (p.assignedDeveloper || '').toLowerCase() === (u.name || '').toLowerCase()
              ).length;
              return {
                id: u.id,
                name: u.name,
                email: u.email,
                role: u.role,
                status: assignedProjects > 0 ? 'Assigned' : 'Available',
                assignedProjects,
                avatar:
                  u.avatar ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || 'Member')}&background=4e45e1&color=fff&bold=true`
              };
            });
          setTeam(activeOnly);
        }
      } catch (err) {
        console.error('Team fetch error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTeamAndProjects();
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-[1440px] w-full mx-auto pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-[var(--apple-blue)] mb-1">
            Engineering & Delivery Roster
          </p>
          <h1 className="text-[28px] sm:text-[32px] font-semibold tracking-tight text-[var(--apple-text-primary)] leading-tight">
            Team Velocity
          </h1>
          <p className="text-[14px] text-[var(--apple-text-secondary)] mt-0.5 max-w-2xl">
            Active workspace members, role assignments, and client project allocation.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0 self-start md:self-center">
          <button
            onClick={() => navigate('/projects')}
            className="h-10 px-4 apple-secondary-btn rounded-[12px] text-[13px] font-medium inline-flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <i className="fas fa-diagram-project text-[var(--apple-blue)] text-xs shrink-0"></i>
            <span>Client Projects ({projectsCount})</span>
          </button>
          <button
            onClick={() => navigate('/users')}
            className="h-10 px-4 apple-pill-btn rounded-[12px] text-[13px] font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <i className="fas fa-user-shield text-xs badge-white shrink-0"></i>
            <span>Manage Access</span>
          </button>
        </div>
      </div>

      {/* Active Team Roster Card */}
      <div className="apple-card p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-[17px] font-semibold text-[var(--apple-text-primary)]">
              Active Workspace Members ({team.length})
            </h3>
            <p className="text-[12px] text-[var(--apple-text-secondary)]">
              Real-time directory synced from Access & Users
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-[13px] text-[var(--apple-text-secondary)]">
            Loading team roster…
          </div>
        ) : team.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {team.map((member) => (
              <div
                key={member.id}
                className="apple-subcard p-4 rounded-[16px] flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <img
                    src={member.avatar}
                    className="w-11 h-11 rounded-full object-cover ring-1 ring-[var(--apple-border)] shrink-0"
                    alt={member.name}
                  />
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-[var(--apple-text-primary)] truncate">
                      {member.name}
                    </p>
                    <p className="text-[12px] text-[var(--apple-text-tertiary)] truncate">
                      {member.email}
                    </p>
                    <span className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#4e45e1]/10 text-[var(--apple-blue)]">
                      {member.role}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-[15px] font-bold text-[var(--apple-text-primary)]">
                    {member.assignedProjects}
                  </p>
                  <p className="text-[10px] font-medium text-[var(--apple-text-tertiary)]">
                    Projects
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="apple-subcard p-10 rounded-[16px] text-center">
            <p className="text-[13px] text-[var(--apple-text-secondary)]">
              No active team members found.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Team;
