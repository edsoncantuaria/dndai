// src/components/MobileToolbar.tsx
'use client';
import React, { useRef } from 'react';
import { motion, useAnimation, useDragControls } from 'framer-motion';
import { cn } from '@/lib/utils';

type Tab = 'character' | 'inventory' | 'spells' | 'progression' | 'relationships' | 'journal';

interface MobileToolbarProps {
    activeTab: Tab;
    setActiveTab: (tab: Tab) => void;
    children: React.ReactNode;
    tabConfig: Record<Tab, { label: string, icon: React.ReactNode }>;
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
}

const MobileToolbar: React.FC<MobileToolbarProps> = ({ activeTab, setActiveTab, children, tabConfig, isOpen, setIsOpen }) => {
    const controls = useAnimation();
    const dragControls = useDragControls();
    const sheetRef = useRef<HTMLDivElement>(null);

    const openSheet = () => {
        controls.start("visible");
        setIsOpen(true);
    };

    const closeSheet = () => {
        controls.start("hidden");
        setIsOpen(false);
    };
    
    const handleTabClick = (tab: Tab) => {
        if (tab === activeTab && isOpen) {
            closeSheet();
        } else {
            setActiveTab(tab);
            openSheet();
        }
    };

    const sheetVariants = {
        hidden: { y: "100%" },
        visible: { y: "0%" }
    };
    
    const backdropVariants = {
        hidden: { opacity: 0, pointerEvents: 'none' as 'none' },
        visible: { opacity: 1, pointerEvents: 'auto' as 'auto' }
    };


    return (
        <>
            {/* Backdrop */}
            <motion.div
                initial="hidden"
                animate={isOpen ? "visible" : "hidden"}
                variants={backdropVariants}
                transition={{ duration: 0.3 }}
                className="fixed inset-0 bg-black/60 z-30 md:hidden"
                onClick={closeSheet}
            />

            {/* Content Sheet */}
            <motion.div
                ref={sheetRef}
                drag="y"
                dragControls={dragControls}
                dragListener={false}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.5 }}
                onDragEnd={(event, info) => {
                    if (info.offset.y > 100 || info.velocity.y > 500) {
                        closeSheet();
                    } else {
                        controls.start("visible"); // Snap back if not dragged enough
                    }
                }}
                initial="hidden"
                animate={controls}
                variants={sheetVariants}
                transition={{ type: "spring", stiffness: 400, damping: 40 }}
                className="fixed bottom-16 left-0 right-0 z-40 md:hidden bg-stone-800/80 backdrop-blur-md rounded-t-lg border-t border-stone-600"
            >
                <div
                    onPointerDown={(e) => dragControls.start(e)}
                    className="w-full flex justify-center items-center py-4 cursor-grab touch-none"
                    aria-label="Arrastar para fechar"
                >
                    <div className="w-8 h-1 bg-stone-600 rounded-full"></div>
                </div>
                <div className="max-h-[calc(85vh-4rem-3rem)] overflow-y-auto p-4">
                    {children}
                </div>
            </motion.div>

            {/* Toolbar */}
            <div className="fixed bottom-0 left-0 right-0 bg-stone-900/90 backdrop-blur-sm border-t border-stone-700 grid grid-cols-6 items-center md:hidden z-50 h-16">
                 {Object.keys(tabConfig).map((key) => {
                    const tabKey = key as Tab;
                    const { label, icon } = tabConfig[tabKey];
                    return (
                        <button 
                            key={tabKey} 
                            onClick={() => handleTabClick(tabKey)} 
                            className={cn(
                                'flex flex-col items-center justify-center p-1 text-xs transition-colors h-full',
                                isOpen && activeTab === tabKey ? 'text-amber-400 bg-amber-900/20' : 'text-stone-400 hover:text-amber-500'
                            )}
                            title={label}
                        >
                            {icon}
                            <span className="mt-1">{label}</span>
                        </button>
                    )
                 })}
            </div>
        </>
    );
};

export default MobileToolbar;
