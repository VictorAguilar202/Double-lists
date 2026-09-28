class Node:
    def __init__(self, value):
        self.value = value
        self.prev = None
        self.next = None


class DoublyLinkedList:
    """Custom doubly linked list: each node points backward and forward."""

    def __init__(self):
        self.head = None
        self.tail = None
        self.size = 0

    def append(self, value):
        new_node = Node(value)
        if self.head is None:
            self.head = self.tail = new_node
        else:
            new_node.prev = self.tail
            self.tail.next = new_node
            self.tail = new_node
        self.size += 1
        return new_node

    def insert_after(self, node, value):
        if node is None:
            raise ValueError("A valid node is required.")
        new_node = Node(value)
        new_node.prev = node
        new_node.next = node.next
        if node.next:
            node.next.prev = new_node
        else:
            self.tail = new_node
        node.next = new_node
        self.size += 1
        return new_node

    def delete_node(self, node):
        if node is None:
            raise ValueError("A valid node is required.")
        if node.prev:
            node.prev.next = node.next
        else:
            self.head = node.next
        if node.next:
            node.next.prev = node.prev
        else:
            self.tail = node.prev
        node.prev = None
        node.next = None
        self.size -= 1

    def find(self, predicate):
        current = self.head
        while current:
            if predicate(current.value):
                return current
            current = current.next
        return None

    def traverse_forward(self):
        current = self.head
        while current:
            yield current.value
            current = current.next

    def traverse_backward(self):
        current = self.tail
        while current:
            yield current.value
            current = current.prev

    def clear(self):
        self.head = None
        self.tail = None
        self.size = 0
