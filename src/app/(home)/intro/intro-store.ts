import { create } from 'zustand'

// 开场动画播放时先不挂载首页卡片，等揭幕时再挂载，卡片自带的入场动画正好接上
export const useIntroStore = create<{ homeVisible: boolean; setHomeVisible: (visible: boolean) => void }>(set => ({
	homeVisible: true,
	setHomeVisible: homeVisible => set({ homeVisible })
}))
