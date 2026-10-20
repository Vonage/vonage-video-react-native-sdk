import Foundation

enum MainThread {
    /// Runs `body` on the main actor. SDK delegate callbacks arrive on the main
    /// queue, so this normally runs synchronously and preserves callback order;
    /// a callback delivered on another thread is hopped to the main queue.
    static func run(_ body: @escaping @MainActor () -> Void) {
        if Thread.isMainThread {
            MainActor.assumeIsolated(body)
        } else {
            let pending = UncheckedSendable(body)
            DispatchQueue.main.async {
                MainActor.assumeIsolated(pending.value)
            }
        }
    }

    /// Hands non-Sendable SDK objects received in a callback to the main actor.
    /// The caller must not use them after this call; only `body` does.
    static func run<A>(_ a: A, _ body: @escaping @MainActor (A) -> Void) {
        let pending = UncheckedSendable((a, body))
        run { pending.value.1(pending.value.0) }
    }

    static func run<A, B>(_ a: A, _ b: B, _ body: @escaping @MainActor (A, B) -> Void) {
        let pending = UncheckedSendable((a, b, body))
        run { pending.value.2(pending.value.0, pending.value.1) }
    }

    static func run<A, B, C>(
        _ a: A, _ b: B, _ c: C, _ body: @escaping @MainActor (A, B, C) -> Void
    ) {
        let pending = UncheckedSendable((a, b, c, body))
        run { pending.value.3(pending.value.0, pending.value.1, pending.value.2) }
    }
}

/// Carries values to the main actor. They are only touched there after the hop.
private struct UncheckedSendable<Value>: @unchecked Sendable {
    let value: Value

    init(_ value: Value) {
        self.value = value
    }
}
