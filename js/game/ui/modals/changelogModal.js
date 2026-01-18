/**
 * Changelog Modal
 * Displays game version history and patch notes
 */

export function createChangelogModal(deps) {
    const {
        openModal,
        closeModal,
        openPauseMenu,
        CHANGELOG
    } = deps

    return function openChangelogModal(opts = {}) {
        const fromPause = !!(opts && opts.fromPause)
        const onBack = typeof opts?.onBack === 'function' ? opts.onBack : null

        openModal('Changelog', (body) => {
            const wrapper = document.createElement('div')
            wrapper.className = 'changelog-modal'

            // Lock Changelog to vertical scrolling only (prevents sideways panning on touchpads/mobile)
            ;(() => {
                let sx = 0
                let sy = 0

                wrapper.addEventListener(
                    'wheel',
                    (e) => {
                        // Trackpads can emit horizontal delta even during normal scroll; block it for this modal.
                        if (Math.abs(e.deltaX || 0) > 0.5) e.preventDefault()
                    },
                    { passive: false }
                )

                wrapper.addEventListener(
                    'touchstart',
                    (e) => {
                        const t = e.touches && e.touches[0]
                        if (!t) return
                        sx = t.clientX
                        sy = t.clientY
                    },
                    { passive: true }
                )

                wrapper.addEventListener(
                    'touchmove',
                    (e) => {
                        const t = e.touches && e.touches[0]
                        if (!t) return
                        const dx = t.clientX - sx
                        const dy = t.clientY - sy
                        // If the gesture is primarily horizontal, cancel it so the panel cannot drift sideways.
                        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 6) e.preventDefault()
                    },
                    { passive: false }
                )
            })()


            const intro = document.createElement('p')
            intro.className = 'modal-subtitle'
            intro.innerHTML =
                'All notable changes to <strong>Emberwood: The Blackbark Oath</strong> are listed here.'
            wrapper.appendChild(intro)

            const isV1 = (v) => /^1\.\d+\.\d+$/.test(String(v || '').trim())

            const release = CHANGELOG.filter((e) => isV1(e.version))
            const alpha = CHANGELOG.filter((e) => !isV1(e.version))

            function normalizeChangelogEntry(entry) {
                if (!entry || typeof entry !== 'object') {
                    return { version: '', title: '', sections: [] }
                }

                const version = String(entry.version || '')
                const title = String(entry.title || entry.date || entry.name || '').trim()

                // Support either legacy schema:
                //   { version, title, sections:[{ heading, items: [...] }] }
                // ...or newer schema:
                //   { version, date, changes:[{ category, items: [...] }] }
                let sections = []
                if (Array.isArray(entry.sections)) {
                    sections = entry.sections
                } else if (Array.isArray(entry.changes)) {
                    sections = entry.changes.map((c) => ({
                        heading: c.heading || c.category || 'Changes',
                        items: Array.isArray(c.items) ? c.items : [],
                    }))
                }

                return { version, title, sections }
            }

            function renderEntries(entries, host, { openFirst = false } = {}) {
                const normalized = (entries || []).map(normalizeChangelogEntry)
                normalized.forEach((entry, index) => {
                    const details = document.createElement('details')
                    if (openFirst && index === 0) details.open = true

                    const summary = document.createElement('summary')
                    summary.innerHTML = `<strong>${entry.version}${entry.title ? ' - ' + entry.title : ''}</strong>`
                    details.appendChild(summary)

                    entry.sections.forEach((section) => {
                        const h4 = document.createElement('h4')
                        h4.textContent = section.heading
                        details.appendChild(h4)

                        const ul = document.createElement('ul')

                        section.items.forEach((item) => {
                            const li = document.createElement('li')

                            // Support either simple strings OR {title, bullets}
                            if (typeof item === 'string') {
                                li.textContent = item
                            } else {
                                const titleSpan = document.createElement('strong')
                                titleSpan.textContent = item.title
                                li.appendChild(titleSpan)

                                if (item.bullets && item.bullets.length) {
                                    const innerUl = document.createElement('ul')
                                    item.bullets.forEach((text) => {
                                        const innerLi = document.createElement('li')
                                        innerLi.textContent = text
                                        innerUl.appendChild(innerLi)
                                    })
                                    li.appendChild(innerUl)
                                }
                            }

                            ul.appendChild(li)
                        })

                        details.appendChild(ul)
                    })

                    host.appendChild(details)
                })
            }

            function renderEraPanel(title, entries, { open = false, openFirstEntry = false } = {}) {
                const panel = document.createElement('details')
                panel.open = !!open

                const summary = document.createElement('summary')
                summary.innerHTML = `<strong>${title}</strong>`
                panel.appendChild(summary)

                renderEntries(entries, panel, { openFirst: openFirstEntry })
                wrapper.appendChild(panel)
            }

            // V1.x.x gets its own collapsible panel (newest open by default)
            renderEraPanel('Release (V1.x.x)', release, { open: true, openFirstEntry: true })

            // Everything else lives in a collapsible Alpha / Early Access panel
            renderEraPanel('Alpha / Early Access (pre-1.0.0)', alpha, { open: false, openFirstEntry: false })

            body.appendChild(wrapper)

            // If opened from the pause menu (or provided with a back callback), show an explicit Back button
            if (fromPause || onBack) {
                const actions = document.createElement('div')
                actions.className = 'modal-actions'

                const btnBack = document.createElement('button')
                btnBack.className = 'btn outline'
                btnBack.textContent = fromPause ? 'Back to Game Menu' : 'Back'
                btnBack.addEventListener('click', () => {
                    closeModal()
                    if (onBack) {
                        try {
                            onBack()
                            return
                        } catch (_) {
                            // fall through
                        }
                    }
                    if (fromPause) {
                        try { openPauseMenu() } catch (_) {}
                    }
                })

                actions.appendChild(btnBack)
                body.appendChild(actions)
            }
        })
    }
}
