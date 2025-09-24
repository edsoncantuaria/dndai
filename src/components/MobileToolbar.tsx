import React, { useState } from 'react';

type Tab = 'character' | 'inventory' | 'spells' | 'progression' | 'relationships' | 'journal';

interface MobileToolbarProps {
    activeTab: Tab;
    setActiveTab: (tab: Tab) => void;
    children: React.ReactNode;
    tabConfig: Record<Tab, { label: string, icon: React.ReactNode }>;
}

const MobileToolbar: React.FC<MobileToolbarProps> = ({ activeTab, setActiveTab, children, tabConfig }) => {
    const [isOpen, setIsOpen] = useState(false);

    const toggleOpen = (tab?: Tab) => {
        if (tab && tab === activeTab && isOpen) {
            setIsOpen(false);
        } else if (tab) {
            setActiveTab(tab);
            setIsOpen(true);
        } else {
            setIsOpen(false);
        }
    };

    return (
        <>
            {/* Backdrop */}
            {isOpen && <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={() => toggleOpen()}></div>}

            {/* Content Sheet */}
            <div 
                className={`fixed bottom-16 left-0 right-0 z-40 md:hidden transition-transform duration-300 ease-in-out ${isOpen ? 'translate-y-0' : 'translate-y-[calc(100%)]'}`}
            >
                <div className="bg-stone-800/80 backdrop-blur-md rounded-t-lg border-t border-stone-600">
                     <button onClick={() => toggleOpen()} className="w-full flex justify-center items-center py-2">
                       <div className="w-8 h-1 bg-stone-600 rounded-full"></div>
                    </button>
                    <div className="max-h-[calc(85vh-4rem)] overflow-y-auto p-4">
                      {children}
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="fixed bottom-0 left-0 right-0 bg-stone-900/90 backdrop-blur-sm border-t border-stone-700 grid grid-cols-6 items-center md:hidden z-50 h-16">
                 {Object.entries(tabConfig).map(([key, {label, icon}]) => (
                    <button 
                        key={key} 
                        onClick={() => toggleOpen(key as Tab)} 
                        className={`flex flex-col items-center justify-center p-1 text-xs transition-colors ${activeTab === key && isOpen ? 'text-amber-400' : 'text-stone-400 hover:text-amber-500'}`}
                        title={label}
                    >
                        {icon}
                        <span className="mt-1">{label}</span>
                    </button>
                 ))}
            </div>
        </>
    );
};

export default MobileToolbar;
