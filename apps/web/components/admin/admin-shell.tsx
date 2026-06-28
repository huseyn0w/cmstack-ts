'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  ExternalLink,
  FileText,
  Files,
  FolderTree,
  Image,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Navigation,
  Palette,
  Puzzle,
  Search,
  Tag,
  Users,
} from 'lucide-react';
import type { Session } from 'next-auth';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { signOutAction } from './sign-out';
import { ThemeToggle } from './theme-toggle';

type User = Session['user'];

interface AdminShellProps {
  children: ReactNode;
  user: User;
  canManageUsers: boolean;
  canManageSettings: boolean;
  canManageSeo: boolean;
  canManageMenus: boolean;
  canManageContacts: boolean;
  canModerateComments: boolean;
}

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
}

interface NavGroup {
  heading: string;
  items: NavItem[];
}

function buildNavGroups(
  canManageUsers: boolean,
  canManageSettings: boolean,
  canManageSeo: boolean,
  canManageMenus: boolean,
  canManageContacts: boolean,
  canModerateComments: boolean,
): NavGroup[] {
  const groups: NavGroup[] = [
    {
      heading: 'Dashboard',
      items: [
        {
          label: 'Dashboard',
          href: '/admin',
          icon: <LayoutDashboard className="h-4 w-4" />,
        },
      ],
    },
    {
      heading: 'Content',
      items: [
        {
          label: 'Posts',
          href: '/admin/posts',
          icon: <FileText className="h-4 w-4" />,
        },
        {
          label: 'Pages',
          href: '/admin/pages',
          icon: <Files className="h-4 w-4" />,
        },
        {
          label: 'Categories',
          href: '/admin/categories',
          icon: <FolderTree className="h-4 w-4" />,
        },
        {
          label: 'Tags',
          href: '/admin/tags',
          icon: <Tag className="h-4 w-4" />,
        },
      ],
    },
    {
      heading: 'Library',
      items: [
        {
          label: 'Media',
          href: '/admin/media',
          icon: <Image className="h-4 w-4" />,
        },
      ],
    },
  ];

  const moderationItems: NavItem[] = [];
  if (canModerateComments) {
    moderationItems.push({
      label: 'Comments',
      href: '/admin/comments',
      icon: <MessageSquare className="h-4 w-4" />,
    });
  }
  if (canManageContacts) {
    moderationItems.push({
      label: 'Contact',
      href: '/admin/contact',
      icon: <Inbox className="h-4 w-4" />,
    });
  }
  if (moderationItems.length > 0) {
    groups.push({ heading: 'Moderation', items: moderationItems });
  }

  if (canManageUsers) {
    groups.push({
      heading: 'People',
      items: [
        {
          label: 'Users',
          href: '/admin/users',
          icon: <Users className="h-4 w-4" />,
        },
      ],
    });
  }

  const siteItems: NavItem[] = [];
  if (canManageSettings) {
    siteItems.push({
      label: 'Appearance',
      href: '/admin/appearance',
      icon: <Palette className="h-4 w-4" />,
    });
    siteItems.push({
      label: 'Plugins',
      href: '/admin/plugins',
      icon: <Puzzle className="h-4 w-4" />,
    });
  }
  if (canManageSeo) {
    siteItems.push({
      label: 'SEO & GEO',
      href: '/admin/seo',
      icon: <Search className="h-4 w-4" />,
    });
  }
  if (canManageMenus) {
    siteItems.push({
      label: 'Menus',
      href: '/admin/menus',
      icon: <Navigation className="h-4 w-4" />,
    });
  }
  if (siteItems.length > 0) {
    groups.push({ heading: 'Site', items: siteItems });
  }

  return groups;
}

function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const last = parts[1]?.[0] ?? '';
    return ((first + last).toUpperCase() || email[0]?.toUpperCase()) ?? 'U';
  }
  return email[0]?.toUpperCase() ?? 'U';
}

function getSectionLabel(pathname: string): string {
  if (pathname === '/admin') return 'Dashboard';
  if (pathname.startsWith('/admin/posts')) return 'Posts';
  if (pathname.startsWith('/admin/pages')) return 'Pages';
  if (pathname.startsWith('/admin/categories')) return 'Categories';
  if (pathname.startsWith('/admin/tags')) return 'Tags';
  if (pathname.startsWith('/admin/media')) return 'Media';
  if (pathname.startsWith('/admin/users')) return 'Users';
  if (pathname.startsWith('/admin/appearance')) return 'Appearance';
  if (pathname.startsWith('/admin/plugins')) return 'Plugins';
  if (pathname.startsWith('/admin/seo')) return 'SEO & GEO';
  if (pathname.startsWith('/admin/menus')) return 'Menus';
  if (pathname.startsWith('/admin/comments')) return 'Comments';
  if (pathname.startsWith('/admin/contact')) return 'Contact';
  return 'Admin';
}

function NavLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  const pathname = usePathname();
  const isActive = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        'group flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm',
        'transition-colors duration-150 relative',
        isActive
          ? 'text-foreground bg-accent font-medium'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted',
      )}
    >
      {isActive && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-primary rounded-full"
          aria-hidden
        />
      )}
      <span
        className={cn(
          'transition-colors duration-150',
          isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
        )}
      >
        {item.icon}
      </span>
      {item.label}
    </Link>
  );
}

function Sidebar({
  user,
  canManageUsers,
  canManageSettings,
  canManageSeo,
  canManageMenus,
  canManageContacts,
  canModerateComments,
  onClose,
}: {
  user: User;
  canManageUsers: boolean;
  canManageSettings: boolean;
  canManageSeo: boolean;
  canManageMenus: boolean;
  canManageContacts: boolean;
  canModerateComments: boolean;
  onClose?: () => void;
}) {
  const navGroups = buildNavGroups(
    canManageUsers,
    canManageSettings,
    canManageSeo,
    canManageMenus,
    canManageContacts,
    canModerateComments,
  );

  return (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-border shrink-0">
        <Link href="/admin" onClick={onClose} className="flex items-center gap-2 w-fit">
          <span className="inline-block w-2 h-2 rounded-full bg-primary" aria-hidden />
          <span className="text-sm font-semibold tracking-tight text-foreground">Cmstack-TS</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5" aria-label="Admin navigation">
        {navGroups.map((group) => (
          <div key={group.heading}>
            <p className="px-3 mb-1.5 font-mono text-[10px] font-semibold tracking-[0.1em] uppercase text-muted-foreground">
              {group.heading}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.href}>
                  <NavLink item={item} onClick={onClose} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer: user summary */}
      <div className="px-4 py-4 border-t border-border shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex-shrink-0 h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center">
            <span className="text-xs font-semibold text-primary">
              {getInitials(user.name, user.email)}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground truncate leading-tight">
              {user.name ?? user.email}
            </p>
            {user.role && (
              <p className="text-[10px] text-muted-foreground leading-tight truncate">
                {user.role.name}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminShell({
  children,
  user,
  canManageUsers,
  canManageSettings,
  canManageSeo,
  canManageMenus,
  canManageContacts,
  canModerateComments,
}: AdminShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const sectionLabel = getSectionLabel(pathname);
  const initials = getInitials(user.name, user.email);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Skip to content — first in tab order (WCAG 2.1 AA). */}
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-[260px] shrink-0 border-r border-border bg-card">
        <Sidebar
          user={user}
          canManageUsers={canManageUsers}
          canManageSettings={canManageSettings}
          canManageSeo={canManageSeo}
          canManageMenus={canManageMenus}
          canManageContacts={canManageContacts}
          canModerateComments={canModerateComments}
        />
      </aside>

      {/* Mobile sidebar via Dialog */}
      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent className="p-0 sm:max-w-xs w-full h-full max-h-full rounded-none border-r border-border left-0 top-0 translate-x-0 translate-y-0 data-[state=open]:slide-in-from-left">
          <DialogHeader className="sr-only">
            <DialogTitle>Navigation</DialogTitle>
          </DialogHeader>
          <div className="h-full">
            <Sidebar
              user={user}
              canManageUsers={canManageUsers}
              canManageSettings={canManageSettings}
              canManageSeo={canManageSeo}
              canManageMenus={canManageMenus}
              canManageContacts={canManageContacts}
              canModerateComments={canModerateComments}
              onClose={() => setMobileOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="flex items-center justify-between h-14 px-4 lg:px-6 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-muted-foreground hover:text-foreground -ml-1"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="h-4 w-4" />
            </Button>

            <h1 className="text-sm font-medium text-foreground">{sectionLabel}</h1>
          </div>

          <div className="flex items-center gap-1">
            <ThemeToggle />

            {/* User dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full text-muted-foreground hover:text-foreground"
                  aria-label="User menu"
                >
                  <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center">
                    <span className="text-[11px] font-semibold text-primary leading-none">
                      {initials}
                    </span>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-2">
                  <p className="text-sm font-medium text-foreground truncate">
                    {user.name ?? user.email}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  {user.role && (
                    <Badge variant="secondary" className="mt-1.5 text-[10px]">
                      {user.role.name}
                    </Badge>
                  )}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link
                    href="/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View site
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive focus:bg-destructive/5"
                  onSelect={async () => {
                    await signOutAction();
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main id="admin-main" tabIndex={-1} className="flex-1 overflow-y-auto focus:outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}
