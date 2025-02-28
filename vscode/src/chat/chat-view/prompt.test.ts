import { type ContextItem, type Message, ps } from '@sourcegraph/cody-shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as vscode from 'vscode'
import { PromptBuilder } from '../../prompt-builder'
import { SimpleChatModel } from './SimpleChatModel'
import { DefaultPrompter } from './prompt'

describe('DefaultPrompter', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('constructs a prompt with no context', async () => {
        const chat = new SimpleChatModel('a-model-id')
        chat.addHumanMessage({ text: ps`Hello` })

        const { prompt, newContextUsed } = await new DefaultPrompter([], () =>
            Promise.resolve([])
        ).makePrompt(chat, 0, 100000)

        expect(prompt).toEqual<Message[]>([
            {
                speaker: 'human',
                text: ps`You are Cody, an AI coding assistant from Sourcegraph.`,
            },
            {
                speaker: 'assistant',
                text: ps`I am Cody, an AI coding assistant from Sourcegraph.`,
            },
            {
                speaker: 'human',
                text: ps`Hello`,
            },
        ])
        expect(newContextUsed).toEqual([])
    })

    it('adds the cody.chat.preInstruction vscode setting if set', async () => {
        const getConfig = vi.spyOn(vscode.workspace, 'getConfiguration')
        getConfig.mockImplementation((section, resource) => ({
            get: vi.fn(() => 'Always respond with 🧀 emojis'),
            has: vi.fn(() => true),
            inspect: vi.fn(() => ({ key: 'key' })),
            update: vi.fn(() => Promise.resolve()),
        }))

        const chat = new SimpleChatModel('a-model-id')
        chat.addHumanMessage({ text: ps`Hello` })

        const { prompt, newContextUsed } = await new DefaultPrompter([], () =>
            Promise.resolve([])
        ).makePrompt(chat, 0, 100000)

        expect(prompt).toEqual<Message[]>([
            {
                speaker: 'human',
                text: ps`You are Cody, an AI coding assistant from Sourcegraph. Always respond with 🧀 emojis`,
            },
            {
                speaker: 'assistant',
                text: ps`I am Cody, an AI coding assistant from Sourcegraph.`,
            },
            {
                speaker: 'human',
                text: ps`Hello`,
            },
        ])
        expect(newContextUsed).toEqual([])
    })

    it('tryAddContext limit should not allow prompt to exceed overall limit', async () => {
        const overallLimit = 1
        const promptBuilder = new PromptBuilder(overallLimit)
        const contextItems: ContextItem[] = [
            {
                type: 'file',
                uri: vscode.Uri.file('/foo/bar'),
                content: 'foobar',
                isTooLarge: true,
            },
        ]

        const { limitReached, ignored, duplicate, used } = promptBuilder.tryAddContext(
            contextItems,
            10_000_000
        )
        expect(limitReached).toBeTruthy()
        expect(ignored).toEqual(contextItems)
        expect(duplicate).toEqual([])
        expect(used).toEqual([])

        const prompt = promptBuilder.build()
        expect(prompt).toEqual([])
    })
})
