import { gql, useQuery, useMutation } from '@apollo/client'
import { ALL_AUTHORS, EDIT_AUTHOR } from '../queries'
import { useState } from 'react'

const Authors = (props) => {
  const result = useQuery(ALL_AUTHORS)
  const [editAuthor] = useMutation(EDIT_AUTHOR, {
    refetchQueries: [{ query: ALL_AUTHORS }],
  })
  const [name, setName] = useState('')
  const [born, setBorn] = useState('')

  if (!props.show) {
    return null
  }

  if (result.loading) {
    return <div>loading...</div>
  }

  const submit = async (e) => {
    e.preventDefault()

    try {
      await editAuthor({ variables: { name, setBornTo: parseInt(born) } })
    } catch (error) {
      console.log(error)
      alert("didn't work! check the developer console for more info...")
    }
  }

  const authors = result.data.allAuthors

  return (
    <div>
      <h2>authors</h2>
      <table>
        <tbody>
          <tr>
            <th></th>
            <th>born</th>
            <th>books</th>
          </tr>
          {authors.map((a) => (
            <tr key={a.name}>
              <td>{a.name}</td>
              <td>{a.born}</td>
              <td>{a.bookCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Set birthyear</h2>

      <form onSubmit={submit}>
        name{' '}
        <input
          value={name}
          onChange={({ target }) => setName(target.value)}
        ></input>
        <br />
        born{' '}
        <input
          value={born}
          onChange={({ target }) => setBorn(target.value)}
        ></input>
        <br />
        <button type="submit">update author</button>
      </form>
    </div>
  )
}

export default Authors
