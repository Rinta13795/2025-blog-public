import { toBase64Utf8, getRef, createTree, createCommit, updateRef, createBlob, readTextFileFromRepo, type TreeItem } from '@/lib/github-client'
import { fileToBase64NoPrefix, hashFileSHA256 } from '@/lib/file-utils'
import { getAuthToken } from '@/lib/auth'
import { GITHUB_CONFIG } from '@/consts'
import { toast } from 'sonner'
import type { Moment } from '../page'
import { extOf, type PreparedMedia } from './prepare-media'

const LIST_PATH = 'src/app/daily/list.json'

export type PushDailyParams = {
	moments: Moment[]
	// 新上传、还只存在于浏览器里的媒体，key 是 moment.id
	pending: Map<string, PreparedMedia>
}

const mediaUrls = (moments: Moment[]) => new Set(moments.flatMap(m => [m.src, m.poster]).filter((url): url is string => !!url))

export async function pushDaily({ moments, pending }: PushDailyParams): Promise<Moment[]> {
	const token = await getAuthToken()

	toast.info('正在获取分支信息...')
	const refData = await getRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`)
	const latestCommitSha = refData.sha

	const treeItems: TreeItem[] = []
	const uploadFile = async (file: File, name: string) => {
		const blob = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, await fileToBase64NoPrefix(file), 'base64')
		treeItems.push({ path: `public/daily/${name}`, mode: '100644', type: 'blob', sha: blob.sha })
		return `/daily/${name}`
	}

	const updated: Moment[] = []
	if (pending.size > 0) toast.info('正在上传照片和视频...')
	for (const moment of moments) {
		const media = pending.get(moment.id)
		if (!media) {
			updated.push(moment)
			continue
		}

		const hash = await hashFileSHA256(media.file)
		const src = await uploadFile(media.file, `${hash}${extOf(media.file)}`)
		const poster = media.poster ? await uploadFile(media.poster, `${hash}${extOf(media.poster)}`) : undefined
		updated.push({ ...moment, src, poster })
	}

	// 删掉 list.json 里已经不再引用的 /daily/ 文件（示例里借用的 /images/pictures 不动）
	toast.info('正在检查需要删除的文件...')
	const previousJson = await readTextFileFromRepo(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, LIST_PATH, GITHUB_CONFIG.BRANCH)
	if (previousJson) {
		try {
			const current = mediaUrls(updated)
			for (const url of mediaUrls(JSON.parse(previousJson))) {
				if (!current.has(url) && url.startsWith('/daily/')) {
					treeItems.push({ path: `public${url}`, mode: '100644', type: 'blob', sha: null })
				}
			}
		} catch (error) {
			console.error('Failed to parse previous daily list.json:', error)
		}
	}

	const listBlob = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, toBase64Utf8(JSON.stringify(updated, null, '\t') + '\n'), 'base64')
	treeItems.push({ path: LIST_PATH, mode: '100644', type: 'blob', sha: listBlob.sha })

	toast.info('正在创建提交...')
	const treeData = await createTree(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, treeItems, latestCommitSha)
	const commitData = await createCommit(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, '更新生活日常', treeData.sha, [latestCommitSha])
	await updateRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`, commitData.sha)

	toast.success('发布成功！部署完成后线上就能看到')
	return updated
}
