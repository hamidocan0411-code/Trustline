import React from 'react';
import { Bell, Check, Clock, PackageCheck, Truck, X } from 'lucide-react';
import { NotificationItem } from '../types';
import { storage } from '../services/storage';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onSelectOrder?: (orderId: string) => void;
  userId: string;
}

export const NotificationDrawer: React.FC<Props> = ({
  isOpen,
  onClose,
  notifications,
  onSelectOrder,
  userId,
}) => {
  if (!isOpen) return null;

  const handleMarkAllRead = () => {
    storage.markAllNotificationsAsRead(userId);
  };

  const getIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'order_status':
        return <PackageCheck className="w-5 h-5 text-[#D6A84F]" />;
      case 'assignment':
        return <Truck className="w-5 h-5 text-emerald-400" />;
      default:
        return <Bell className="w-5 h-5 text-amber-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-xs animate-fadeIn">
      <div 
        className="w-full max-w-md bg-[#19191E] border-l border-[#303036] flex flex-col h-full shadow-2xl animate-slideLeft"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-[#303036] flex items-center justify-between bg-[#0B0B0D]">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-[#D6A84F]" />
            <h2 className="font-bold text-lg text-white">Bildirimler</h2>
            <span className="text-xs bg-[#222229] text-[#D6A84F] px-2 py-0.5 rounded-full border border-[#303036]">
              {notifications.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {notifications.some((n) => !n.read) && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-[#999999] hover:text-[#D6A84F] flex items-center gap-1 transition-colors px-2 py-1 rounded"
              >
                <Check className="w-3.5 h-3.5" />
                Tümünü Okundu Say
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#999999] hover:text-white hover:bg-[#222229] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {notifications.length === 0 ? (
            <div className="text-center py-16 text-[#999999]">
              <Bell className="w-12 h-12 mx-auto mb-3 opacity-30 text-[#D6A84F]" />
              <p className="font-medium text-white">Henüz bildiriminiz yok</p>
              <p className="text-xs mt-1">Sipariş durumu güncellemeleri burada listelenecektir.</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => {
                  storage.markNotificationAsRead(notif.id);
                  if (notif.orderId && onSelectOrder) {
                    onSelectOrder(notif.orderId);
                    onClose();
                  }
                }}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  notif.read
                    ? 'bg-[#19191E] border-[#303036]/60 opacity-80'
                    : 'bg-[#222229] border-[#D6A84F]/40 shadow-sm shadow-[#D6A84F]/10'
                } hover:border-[#D6A84F]`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-[#0B0B0D] border border-[#303036] shrink-0">
                    {getIcon(notif.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold text-white truncate">{notif.title}</h4>
                      {!notif.read && (
                        <span className="w-2 h-2 rounded-full bg-[#D6A84F] shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-[#999999] mt-1 leading-relaxed">{notif.message}</p>
                    <div className="flex items-center gap-2 mt-2 text-[11px] text-[#999999]">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(notif.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                      {notif.orderId && (
                        <span className="text-[#D6A84F] font-mono text-[11px]">#{notif.orderId}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
