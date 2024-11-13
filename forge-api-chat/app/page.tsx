'use client'

import React, { useState } from 'react'
import { ChevronDown, ChevronRight, Send } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type JsonValue = string | number | boolean | null | JsonObject | JsonArray
type JsonObject = { [key: string]: JsonValue }
type JsonArray = JsonValue[]

interface JsonViewerProps {
  data: JsonValue
  initialExpanded?: boolean
}

const JsonViewer: React.FC<JsonViewerProps> = ({ data, initialExpanded = false }) => {
  const [isExpanded, setIsExpanded] = useState(initialExpanded)

  if (typeof data !== 'object' || data === null) {
    return <span className="text-green-600">{JSON.stringify(data)}</span>
  }

  const toggleExpand = () => setIsExpanded(!isExpanded)

  const renderObjectOrArray = (obj: JsonObject | JsonArray) => {
    const isArray = Array.isArray(obj)
    const items = isArray ? obj : Object.entries(obj)

    return (
      <div className="pl-4">
        {items.map((item, index) => {
          const key = isArray ? index : (item as [string, JsonValue])[0]
          const value = isArray ? item : (item as [string, JsonValue])[1]
          return (
            <div key={key} className="my-1">
              <span className="text-blue-600">{key}: </span>
              <JsonViewer data={value} />
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div>
      <button onClick={toggleExpand} className="flex items-center text-gray-700 hover:text-gray-900">
        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <span className="ml-1">{Array.isArray(data) ? 'Array' : 'Object'}</span>
      </button>
      {isExpanded && renderObjectOrArray(data)}
    </div>
  )
}

export default function Component() {
  const [apiKey, setApiKey] = useState('')
  const [prompt, setPrompt] = useState('')
  const [response, setResponse] = useState<JsonValue | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const baseUrl = 'https://forge-api.nousresearch.com/v1/asyncplanner/completions'

  const sendMessage = async () => {
    setLoading(true)
    setError(null)
    setResponse(null)

    try {
      const initResponse = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt,
          reasoning_speed: 'medium',
          track: true,
        }),
      })

      if (!initResponse.ok) {
        throw new Error(`HTTP error! status: ${initResponse.status}`)
      }

      const initData = await initResponse.json()
      const taskId = initData.task_id

      let pollCount = 0
      const maxPolls = 60 // 5 minutes with 5-second intervals

      while (pollCount < maxPolls) {
        await new Promise(resolve => setTimeout(resolve, 5000)) // Wait 5 seconds

        const pollResponse = await fetch(`${baseUrl}/${taskId}`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
        })

        if (!pollResponse.ok) {
          throw new Error(`HTTP error! status: ${pollResponse.status}`)
        }

        const pollData = await pollResponse.json()
        const status = pollData.metadata?.status

        if (status === 'succeeded') {
          setResponse(pollData)
          break
        } else if (status === 'failed' || status === 'cancelled') {
          throw new Error(`Task ${status}`)
        }

        pollCount++
      }

      if (pollCount >= maxPolls) {
        throw new Error('Polling timed out')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Forge API Chat</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label htmlFor="api-key" className="block text-sm font-medium text-gray-700">
                API Key
              </label>
              <Input
                id="api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your Forge API key"
                className="mt-1"
              />
            </div>
            <div>
              <label htmlFor="prompt" className="block text-sm font-medium text-gray-700">
                Prompt
              </label>
              <Textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter your prompt here"
                rows={4}
                className="mt-1"
              />
            </div>
            <Button onClick={sendMessage} disabled={loading || !apiKey || !prompt}>
              {loading ? 'Processing...' : 'Send'}
              <Send className="w-4 h-4 ml-2" />
            </Button>
            {error && (
              <div className="text-red-500 mt-2">
                Error: {error}
              </div>
            )}
            {response && (
              <div className="mt-4">
                <h2 className="text-lg font-semibold mb-2">Response:</h2>
                <div className="bg-gray-100 p-4 rounded-lg overflow-auto max-h-[60vh]">
                  <JsonViewer data={response} />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}