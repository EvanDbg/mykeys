/**
 * 企业微信自定义菜单管理
 */

import { getAccessToken } from './api.js';
import type { WeComConfig } from '../../config.js';

interface MenuButton {
    name: string;
    type?: 'click' | 'view';
    key?: string;
    url?: string;
    sub_button?: MenuButton[];
}

interface MenuConfig {
    button: MenuButton[];
}

/**
 * 创建应用菜单
 */
export async function createMenu(config: WeComConfig): Promise<{ success: boolean; message: string }> {
    const menuConfig: MenuConfig = {
        button: [
            {
                name: '📋 列表',
                type: 'click',
                key: 'CMD_LIST',
            },
            {
                name: '➕ 添加',
                type: 'click',
                key: 'CMD_ADD',
            },
            {
                name: '更多',
                sub_button: [
                    {
                        name: '⏰ 到期提醒',
                        type: 'click',
                        key: 'CMD_EXPIRING',
                    },
                    {
                        name: '❓ 帮助',
                        type: 'click',
                        key: 'CMD_HELP',
                    },
                ],
            },
        ],
    };

    try {
        const accessToken = await getAccessToken(config.corpId, config.secret);
        const url = `https://qyapi.weixin.qq.com/cgi-bin/menu/create?access_token=${accessToken}&agentid=${config.agentId}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(menuConfig),
        });

        const result = await response.json() as { errcode: number; errmsg: string };

        if (result.errcode === 0) {
            return { success: true, message: '菜单创建成功' };
        }

        return { success: false, message: `错误 ${result.errcode}: ${result.errmsg}` };
    } catch (error) {
        return { success: false, message: `请求失败: ${error}` };
    }
}

/**
 * 获取应用菜单
 */
export async function getMenu(config: WeComConfig): Promise<{ success: boolean; data?: MenuConfig; message?: string }> {
    try {
        const accessToken = await getAccessToken(config.corpId, config.secret);
        const url = `https://qyapi.weixin.qq.com/cgi-bin/menu/get?access_token=${accessToken}&agentid=${config.agentId}`;

        const response = await fetch(url);
        const result = await response.json() as { errcode: number; errmsg: string; button?: MenuButton[] };

        if (result.errcode === 0) {
            return { success: true, data: { button: result.button || [] } };
        }

        return { success: false, message: `错误 ${result.errcode}: ${result.errmsg}` };
    } catch (error) {
        return { success: false, message: `请求失败: ${error}` };
    }
}

/**
 * 删除应用菜单
 */
export async function deleteMenu(config: WeComConfig): Promise<{ success: boolean; message: string }> {
    try {
        const accessToken = await getAccessToken(config.corpId, config.secret);
        const url = `https://qyapi.weixin.qq.com/cgi-bin/menu/delete?access_token=${accessToken}&agentid=${config.agentId}`;

        const response = await fetch(url);
        const result = await response.json() as { errcode: number; errmsg: string };

        if (result.errcode === 0) {
            return { success: true, message: '菜单删除成功' };
        }

        return { success: false, message: `错误 ${result.errcode}: ${result.errmsg}` };
    } catch (error) {
        return { success: false, message: `请求失败: ${error}` };
    }
}
